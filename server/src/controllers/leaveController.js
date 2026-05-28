const Leave = require('../models/Leave');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES } = require('../constants/roles');
const { canAccessUser, getAccessibleUserIds } = require('../middleware/rbac');
const { notifyUser } = require('../services/notificationService');

const requestLeave = asyncHandler(async (req, res) => {
  const leave = await Leave.create({ user: req.user._id, ...req.body, status: 'Pending' });
  const managers = await User.find({ $or: [{ role: ROLES.ADMIN }, { _id: req.user.assignedHR }, { _id: req.user.assignedTeamLeader }] }).select('_id');
  await Promise.all(managers.map(m => notifyUser({ user: m._id, title: 'Leave request submitted', message: `${req.user.name || req.user.email} submitted a leave request`, type: 'leave_request', metadata: { leaveId: leave._id } })));
  res.status(201).json({ success: true, leave });
});

const list = asyncHandler(async (req, res) => {
  const ids = await getAccessibleUserIds(req.user);
  const data = await Leave.find({ user: { $in: ids } }).populate('user', 'name email employeeId role').populate('approvedBy', 'name email').sort({ createdAt: -1 });
  res.json({ success: true, data });
});

const approve = asyncHandler(async (req, res) => {
  if (![ROLES.ADMIN, ROLES.HR].includes(req.user.role)) throw new ApiError(403, 'Only Admin/HR can approve leave');
  const leave = await Leave.findById(req.params.id);
  if (!leave) throw new ApiError(404, 'Leave not found');
  if (!(await canAccessUser(req.user, leave.user))) throw new ApiError(403, 'Access denied');
  leave.status = 'Approved';
  leave.approvedBy = req.user._id;
  leave.approvedAt = new Date();
  await leave.save();
  await notifyUser({ user: leave.user, title: 'Leave approved', message: 'Your leave request was approved', type: 'leave_approved', metadata: { leaveId: leave._id } });
  res.json({ success: true, leave });
});

const reject = asyncHandler(async (req, res) => {
  if (![ROLES.ADMIN, ROLES.HR].includes(req.user.role)) throw new ApiError(403, 'Only Admin/HR can reject leave');
  const leave = await Leave.findById(req.params.id);
  if (!leave) throw new ApiError(404, 'Leave not found');
  if (!(await canAccessUser(req.user, leave.user))) throw new ApiError(403, 'Access denied');
  leave.status = 'Rejected';
  leave.approvedBy = req.user._id;
  leave.approvedAt = new Date();
  leave.rejectedReason = req.body.rejectedReason || 'No reason provided';
  await leave.save();
  await notifyUser({ user: leave.user, title: 'Leave rejected', message: leave.rejectedReason, type: 'leave_rejected', metadata: { leaveId: leave._id } });
  res.json({ success: true, leave });
});

module.exports = { requestLeave, list, approve, reject };
