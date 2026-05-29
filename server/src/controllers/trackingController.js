const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const ApiError = require('../utils/ApiError');
const { processHeartbeat, markOffline } = require('../services/trackingService');
const { ACTIVITY_STATES } = require('../constants/roles');
const { getAccessibleUserIds, canAccessUser } = require('../middleware/rbac');
const { startOfDay, endOfDay } = require('../utils/time');
const env = require('../config/env');

const heartbeat = asyncHandler(async (req, res) => {
  const attendance = await processHeartbeat({
    user: req.user,
    state: req.body.state || ACTIVITY_STATES.ACTIVE,
    req,
    metadata: req.body.metadata || {},
    activitySource: req.body.activitySource || 'CRM_PWA'
  });

  res.json({ success: true, attendance });
});

const markIdle = asyncHandler(async (req, res) => {
  const attendance = await processHeartbeat({
    user: req.user,
    state: ACTIVITY_STATES.IDLE,
    req,
    metadata: { event: 'idle' }
  });

  res.json({ success: true, attendance });
});

const markActive = asyncHandler(async (req, res) => {
  const attendance = await processHeartbeat({
    user: req.user,
    state: ACTIVITY_STATES.ACTIVE,
    req,
    metadata: { event: 'active' }
  });

  res.json({ success: true, attendance });
});

const offline = asyncHandler(async (req, res) => {
  const attendance = await markOffline(req.user, req, {
    ...(req.body.metadata || {}),
    reason: req.body.reason || 'manual_offline'
  });

  res.json({ success: true, attendance });
});

const offlineBeacon = asyncHandler(async (req, res) => {
  const token = req.body?.token;

  if (!token) {
    return res.status(204).end();
  }

  let payload;

  try {
    payload = jwt.verify(token, env.jwtAccessSecret);
  } catch {
    return res.status(204).end();
  }

  const user = await User.findById(payload.sub);

  if (!user || !user.isActive) {
    return res.status(204).end();
  }

  await markOffline(user, req, {
    ...(req.body.metadata || {}),
    reason: 'app_closed'
  });

  return res.status(204).end();
});

const children = asyncHandler(async (req, res) => {
  const ids = await getAccessibleUserIds(req.user);

  const users = await User.find({ _id: { $in: ids }, isActive: true }).select(
    'name email role employeeId onlineStatus currentActivityState lastSeen shiftStart shiftEnd assignedHR assignedTeamLeader'
  );

  res.json({ success: true, users });
});

const childByUser = asyncHandler(async (req, res) => {
  if (!(await canAccessUser(req.user, req.params.userId))) {
    throw new ApiError(403, 'Access denied');
  }

  const attendance = await Attendance.find({ user: req.params.userId })
    .sort({ date: -1 })
    .limit(30)
    .lean();

  res.json({ success: true, attendance });
});

const summary = asyncHandler(async (req, res) => {
  const ids = await getAccessibleUserIds(req.user);
  const today = { $gte: startOfDay(), $lte: endOfDay() };

  const [states, totals] = await Promise.all([
    User.aggregate([
      { $match: { _id: { $in: ids }, isActive: true } },
      { $group: { _id: '$currentActivityState', count: { $sum: 1 } } }
    ]),
    Attendance.aggregate([
      { $match: { user: { $in: ids }, date: today } },
      {
        $group: {
          _id: null,
          active: { $sum: '$activeTimeInsideShift' },
          idle: { $sum: '$idleTimeInsideShift' },
          breakTime: { $sum: '$breakTimeInsideShift' },
          offline: { $sum: '$offlineTimeInsideShift' },
          outOfShift: { $sum: '$activeTimeOutsideShift' },
          offlineOutOfShift: { $sum: '$offlineTimeOutsideShift' }
        }
      }
    ])
  ]);

  res.json({ success: true, states, totals: totals[0] || {} });
});

const workingHoursReport = asyncHandler(async (req, res) => {
  const ids = await getAccessibleUserIds(req.user);
  const from = req.query.from ? new Date(req.query.from) : startOfDay();
  const to = req.query.to ? new Date(req.query.to) : endOfDay();

  const report = await Attendance.find({
    user: { $in: ids },
    date: { $gte: startOfDay(from), $lte: endOfDay(to) }
  })
    .populate('user', 'name email employeeId role')
    .sort({ date: -1 })
    .lean();

  res.json({ success: true, report });
});

module.exports = {
  heartbeat,
  markIdle,
  markActive,
  offline,
  offlineBeacon,
  children,
  childByUser,
  summary,
  workingHoursReport
};
