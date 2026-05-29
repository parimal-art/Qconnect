const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Break = require('../models/Break');
const { ACTIVITY_STATES } = require('../constants/roles');
const { splitDurationByShift, getShiftBounds, startOfDay } = require('../utils/time');
const env = require('../config/env');
const { broadcastChildStatus } = require('./notificationService');

const stateBucketMap = {
  [ACTIVITY_STATES.ACTIVE]: 'active',
  [ACTIVITY_STATES.ONLINE]: 'active',
  [ACTIVITY_STATES.IDLE]: 'idle',
  [ACTIVITY_STATES.ON_BREAK]: 'break',
  [ACTIVITY_STATES.OFFLINE]: 'offline'
};

const number = value => Number(value || 0);

const addMs = (attendance, key, value) => {
  attendance[key] = number(attendance[key]) + number(value);
};

const toPlainAttendance = attendance => {
  if (!attendance) return null;
  if (typeof attendance.toObject === 'function') return attendance.toObject();
  return attendance;
};

const buildStatusPayload = (user, state, now, attendance) => ({
  userId: user._id,
  employeeId: user.employeeId,
  role: user.role,
  onlineStatus: state === ACTIVITY_STATES.OFFLINE ? 'offline' : 'online',
  currentActivityState: state,
  lastSeen: now,
  attendance: toPlainAttendance(attendance)
});

const broadcastStatus = (user, payload) => {
  if (user.assignedHR) {
    broadcastChildStatus(`user:${String(user.assignedHR)}`, payload);
  }

  if (user.assignedTeamLeader) {
    broadcastChildStatus(`user:${String(user.assignedTeamLeader)}`, payload);
  }

  broadcastChildStatus('admins', payload);
};

const applyDuration = (attendance, from, to, state, activitySource = 'CRM_PWA') => {
  const { insideShiftMs, outsideShiftMs, totalMs } = splitDurationByShift({
    from,
    to,
    shiftStart: attendance.shiftStart,
    shiftEnd: attendance.shiftEnd,
    date: attendance.date
  });

  if (totalMs <= 0) {
    return { insideShiftMs: 0, outsideShiftMs: 0, totalMs: 0 };
  }

  const bucket = stateBucketMap[state] || 'active';

  if (bucket === 'active') {
    if (activitySource === 'DESKTOP_TRACKER') {
      addMs(attendance, 'desktopActiveTimeInsideShift', insideShiftMs);
      addMs(attendance, 'desktopActiveTimeOutsideShift', outsideShiftMs);
    } else {
      addMs(attendance, 'activeTimeInsideShift', insideShiftMs);
      addMs(attendance, 'activeTimeOutsideShift', outsideShiftMs);
    }
  }

  if (bucket === 'idle') {
    addMs(attendance, 'idleTimeInsideShift', insideShiftMs);
    addMs(attendance, 'totalIdleTime', totalMs);
  }

  if (bucket === 'break') {
    addMs(attendance, 'breakTimeInsideShift', insideShiftMs);
    addMs(attendance, 'totalBreakTime', totalMs);
  }

  addMs(attendance, 'totalLoggedInTime', totalMs);

  return { insideShiftMs, outsideShiftMs, totalMs };
};

const applyOfflineDuration = (attendance, from, to) => {
  if (!from || !to) {
    return { insideShiftMs: 0, outsideShiftMs: 0, totalMs: 0 };
  }

  const { insideShiftMs, outsideShiftMs, totalMs } = splitDurationByShift({
    from,
    to,
    shiftStart: attendance.shiftStart,
    shiftEnd: attendance.shiftEnd,
    date: attendance.date
  });

  if (totalMs <= 0) {
    return { insideShiftMs: 0, outsideShiftMs: 0, totalMs: 0 };
  }

  addMs(attendance, 'offlineTimeInsideShift', insideShiftMs);
  addMs(attendance, 'offlineTimeOutsideShift', outsideShiftMs);
  addMs(attendance, 'totalOfflineTime', totalMs);

  return { insideShiftMs, outsideShiftMs, totalMs };
};

const ensureAttendanceSession = async (user, req, now = new Date()) => {
  const date = startOfDay(now);
  const { start, end } = getShiftBounds(date, user.shiftStart, user.shiftEnd);
  const totalShiftTime = Math.max(0, end.getTime() - start.getTime());

  let attendance = await Attendance.findOne({
    user: user._id,
    date
  });

  if (!attendance) {
    attendance = await Attendance.create({
      user: user._id,
      date,
      shiftStart: user.shiftStart,
      shiftEnd: user.shiftEnd,
      loginTime: now,
      totalShiftTime,
      currentState: ACTIVITY_STATES.ACTIVE,
      lastHeartbeatAt: now,
      lastStateStartedAt: now,
      deviceInfo: {
        userAgent: req?.headers?.['user-agent'],
        ipAddress: req?.ip,
        platform: req?.body?.platform
      }
    });

    return attendance;
  }

  if (attendance.status === 'CLOSED') {
    if (attendance.offlineStartedAt) {
      applyOfflineDuration(attendance, attendance.offlineStartedAt, now);
    }

    attendance.status = 'OPEN';
    attendance.logoutTime = undefined;
    attendance.offlineStartedAt = undefined;
    attendance.loginTime = attendance.loginTime || now;
    attendance.lastHeartbeatAt = now;
    attendance.lastStateStartedAt = now;
    attendance.currentState = ACTIVITY_STATES.ACTIVE;

    await attendance.save();
  }

  return attendance;
};

const processHeartbeat = async ({
  user,
  state = ACTIVITY_STATES.ACTIVE,
  req,
  metadata = {},
  activitySource = 'CRM_PWA'
}) => {
  const now = new Date();
  const attendance = await ensureAttendanceSession(user, req, now);

  const previousAt = attendance.lastHeartbeatAt || attendance.loginTime || now;

  const gapSeconds = Math.max(
    0,
    (now.getTime() - new Date(previousAt).getTime()) / 1000
  );

  const cappedPreviousAt =
    gapSeconds > env.offlineAfterSeconds
      ? new Date(now.getTime() - env.heartbeatIntervalSeconds * 1000)
      : previousAt;

  const duration = applyDuration(
    attendance,
    cappedPreviousAt,
    now,
    attendance.currentState || state,
    activitySource
  );

  attendance.currentState = state;
  attendance.lastHeartbeatAt = now;
  attendance.lastStateStartedAt = now;

  attendance.heartbeatLogs.push({
    at: now,
    state,
    activitySource,
    ...duration,
    metadata
  });

  if (attendance.heartbeatLogs.length > 1000) {
    attendance.heartbeatLogs.splice(0, attendance.heartbeatLogs.length - 1000);
  }

  await attendance.save();

  await User.findByIdAndUpdate(user._id, {
    onlineStatus: state === ACTIVITY_STATES.OFFLINE ? 'offline' : 'online',
    currentActivityState: state,
    lastSeen: now
  });

  const payload = buildStatusPayload(user, state, now, attendance);
  broadcastStatus(user, payload);

  return attendance;
};

const markOffline = async (user, req, metadata = {}) => {
  const now = new Date();
  const attendance = await ensureAttendanceSession(user, req, now);

  if (attendance.status === 'OPEN') {
    applyDuration(
      attendance,
      attendance.lastHeartbeatAt || attendance.loginTime || now,
      now,
      attendance.currentState || ACTIVITY_STATES.ACTIVE
    );
  }

  attendance.logoutTime = now;
  attendance.lastLogoutTime = now;
  attendance.offlineStartedAt = now;
  attendance.status = 'CLOSED';
  attendance.currentState = ACTIVITY_STATES.OFFLINE;
  attendance.lastHeartbeatAt = now;
  attendance.lastStateStartedAt = now;

  attendance.logoutHistory.push({
    at: now,
    reason: metadata.reason || metadata.event || 'offline'
  });

  attendance.heartbeatLogs.push({
    at: now,
    state: ACTIVITY_STATES.OFFLINE,
    activitySource: 'CRM_PWA',
    insideShiftMs: 0,
    outsideShiftMs: 0,
    metadata
  });

  await attendance.save();

  await User.findByIdAndUpdate(user._id, {
    onlineStatus: 'offline',
    currentActivityState: ACTIVITY_STATES.OFFLINE,
    lastSeen: now
  });

  const payload = buildStatusPayload(user, ACTIVITY_STATES.OFFLINE, now, attendance);
  broadcastStatus(user, payload);

  return attendance;
};

const closeStaleOpenAttendances = async () => {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - env.offlineAfterSeconds * 1000);

  const openAttendances = await Attendance.find({
    status: 'OPEN',
    lastHeartbeatAt: { $lt: staleBefore }
  }).populate('user');

  for (const attendance of openAttendances) {
    const user = attendance.user;

    if (!user || !user.isActive) continue;

    const offlineAt = new Date(
      attendance.lastHeartbeatAt.getTime() + env.heartbeatIntervalSeconds * 1000
    );

    applyDuration(
      attendance,
      attendance.lastHeartbeatAt || attendance.loginTime || offlineAt,
      offlineAt,
      attendance.currentState || ACTIVITY_STATES.ACTIVE
    );

    attendance.logoutTime = offlineAt;
    attendance.lastLogoutTime = offlineAt;
    attendance.offlineStartedAt = offlineAt;
    attendance.status = 'CLOSED';
    attendance.currentState = ACTIVITY_STATES.OFFLINE;
    attendance.lastHeartbeatAt = offlineAt;
    attendance.lastStateStartedAt = offlineAt;

    attendance.logoutHistory.push({
      at: offlineAt,
      reason: 'heartbeat_timeout'
    });

    await attendance.save();

    await User.findByIdAndUpdate(user._id, {
      onlineStatus: 'offline',
      currentActivityState: ACTIVITY_STATES.OFFLINE,
      lastSeen: offlineAt
    });

    const payload = buildStatusPayload(user, ACTIVITY_STATES.OFFLINE, offlineAt, attendance);
    broadcastStatus(user, payload);
  }
};

const accrueOfflineTimeForClosedAttendances = async () => {
  const now = new Date();

  const closedAttendances = await Attendance.find({
    status: 'CLOSED',
    offlineStartedAt: { $ne: null },
    date: startOfDay(now)
  });

  for (const attendance of closedAttendances) {
    applyOfflineDuration(attendance, attendance.offlineStartedAt, now);
    attendance.offlineStartedAt = now;
    await attendance.save();
  }
};

const runTrackingSweep = async () => {
  await closeStaleOpenAttendances();
  await accrueOfflineTimeForClosedAttendances();
};

const startBreak = async ({ user, type = 'Short break', reason = '', req }) => {
  const attendance = await processHeartbeat({
    user,
    state: ACTIVITY_STATES.ON_BREAK,
    req,
    metadata: { breakStarted: true }
  });

  const activeBreak = await Break.findOne({
    user: user._id,
    status: 'OPEN'
  });

  if (activeBreak) return activeBreak;

  return Break.create({
    user: user._id,
    attendance: attendance._id,
    type,
    reason,
    startTime: new Date()
  });
};

const endBreak = async ({ user, req }) => {
  const activeBreak = await Break.findOne({
    user: user._id,
    status: 'OPEN'
  });

  if (activeBreak) {
    activeBreak.endTime = new Date();
    activeBreak.duration = Math.max(
      0,
      activeBreak.endTime.getTime() - activeBreak.startTime.getTime()
    );
    activeBreak.status = 'CLOSED';
    await activeBreak.save();
  }

  await processHeartbeat({
    user,
    state: ACTIVITY_STATES.ACTIVE,
    req,
    metadata: { breakEnded: true }
  });

  return activeBreak;
};

module.exports = {
  ensureAttendanceSession,
  processHeartbeat,
  markOffline,
  startBreak,
  endBreak,
  runTrackingSweep
};