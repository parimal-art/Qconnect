const Attendance = require('../models/Attendance');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { processHeartbeat, markOffline } = require('../services/trackingService');
const { ACTIVITY_STATES } = require('../constants/roles');
const { getAccessibleUserIds, canAccessUser } = require('../middleware/rbac');
const { startOfDay, endOfDay } = require('../utils/time');
const ApiError = require('../utils/ApiError');

const loginAttendance = asyncHandler(async (req, res) => {
  const attendance = await processHeartbeat({ user: req.user, state: ACTIVITY_STATES.ACTIVE, req, metadata: { event: 'attendance_login' } });
  res.json({ success: true, attendance });
});

const logoutAttendance = asyncHandler(async (req, res) => {
  const attendance = await markOffline(req.user, req);
  res.json({ success: true, attendance });
});

const getUserAttendance = asyncHandler(async (req, res) => {
  if (!(await canAccessUser(req.user, req.params.id))) throw new ApiError(403, 'Access denied');
  const data = await Attendance.find({ user: req.params.id }).sort({ date: -1 }).limit(Number(req.query.limit || 60));
  res.json({ success: true, data });
});

const attendanceReport = asyncHandler(async (req, res) => {
  let ids;

  if (req.query.userId) {
    if (!(await canAccessUser(req.user, req.query.userId))) throw new ApiError(403, 'Access denied');
    ids = [req.query.userId];
  } else {
    ids = await getAccessibleUserIds(req.user);
  }

  const from = req.query.from ? new Date(req.query.from) : startOfDay();
  const to = req.query.to ? new Date(req.query.to) : endOfDay();
  const data = await Attendance.find({ user: { $in: ids }, date: { $gte: startOfDay(from), $lte: endOfDay(to) } }).populate('user', 'name email employeeId role').sort({ date: -1 }).lean();
  res.json({ success: true, data });
});

const activeUsers = asyncHandler(async (req, res) => {
  const ids = await getAccessibleUserIds(req.user);
  const users = await User.find({ _id: { $in: ids }, onlineStatus: 'online', isActive: true }).select('name email employeeId role currentActivityState lastSeen');
  res.json({ success: true, users });
});

module.exports = { loginAttendance, logoutAttendance, getUserAttendance, attendanceReport, activeUsers };
