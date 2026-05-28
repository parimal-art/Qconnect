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
  [ACTIVITY_STATES.ON_BREAK]: 'break'
};

const ensureAttendanceSession = async (user, req, now = new Date()) => {
  const date = startOfDay(now);
  const { start, end } = getShiftBounds(date, user.shiftStart, user.shiftEnd);
  const totalShiftTime = Math.max(0, end.getTime() - start.getTime());
  let attendance = await Attendance.findOne({ user: user._id, date });
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
  } else if (attendance.status === 'CLOSED') {
    attendance.status = 'OPEN';
    attendance.logoutTime = undefined;
    attendance.loginTime = attendance.loginTime || now;
    attendance.lastHeartbeatAt = now;
    attendance.lastStateStartedAt = now;
    await attendance.save();
  }
  return attendance;
};

const applyDuration = (attendance, from, to, state, activitySource = 'CRM_PWA') => {
  const { insideShiftMs, outsideShiftMs, totalMs } = splitDurationByShift({
    from,
    to,
    shiftStart: attendance.shiftStart,
    shiftEnd: attendance.shiftEnd,
    date: attendance.date
  });
  if (totalMs <= 0) return { insideShiftMs: 0, outsideShiftMs: 0, totalMs: 0 };

  const bucket = stateBucketMap[state] || 'active';
  if (bucket === 'active') {
    if (activitySource === 'DESKTOP_TRACKER') {
      attendance.desktopActiveTimeInsideShift += insideShiftMs;
      attendance.desktopActiveTimeOutsideShift += outsideShiftMs;
    } else {
      attendance.activeTimeInsideShift += insideShiftMs;
      attendance.activeTimeOutsideShift += outsideShiftMs;
    }
  }
  if (bucket === 'idle') {
    attendance.idleTimeInsideShift += insideShiftMs;
    attendance.totalIdleTime += totalMs;
  }
  if (bucket === 'break') {
    attendance.breakTimeInsideShift += insideShiftMs;
    attendance.totalBreakTime += totalMs;
  }
  attendance.totalLoggedInTime += totalMs;
  return { insideShiftMs, outsideShiftMs, totalMs };
};

const processHeartbeat = async ({ user, state = ACTIVITY_STATES.ACTIVE, req, metadata = {}, activitySource = 'CRM_PWA' }) => {
  const now = new Date();
  const attendance = await ensureAttendanceSession(user, req, now);
  const previousAt = attendance.lastHeartbeatAt || attendance.loginTime || now;
  const cappedPreviousAt = (now.getTime() - previousAt.getTime()) / 1000 > env.offlineAfterSeconds
    ? new Date(now.getTime() - env.heartbeatIntervalSeconds * 1000)
    : previousAt;

  const duration = applyDuration(attendance, cappedPreviousAt, now, attendance.currentState || state, activitySource);
  attendance.currentState = state;
  attendance.lastHeartbeatAt = now;
  attendance.lastStateStartedAt = now;
  attendance.heartbeatLogs.push({ at: now, state, activitySource, ...duration, metadata });
  if (attendance.heartbeatLogs.length > 1000) attendance.heartbeatLogs.splice(0, attendance.heartbeatLogs.length - 1000);
  await attendance.save();

  await User.findByIdAndUpdate(user._id, {
    onlineStatus: state === ACTIVITY_STATES.OFFLINE ? 'offline' : 'online',
    currentActivityState: state,
    lastSeen: now
  });

  const payload = {
    userId: user._id,
    employeeId: user.employeeId,
    role: user.role,
    onlineStatus: state === ACTIVITY_STATES.OFFLINE ? 'offline' : 'online',
    currentActivityState: state,
    lastSeen: now,
    attendance
  };
  if (user.assignedHR) broadcastChildStatus(`user:${String(user.assignedHR)}`, payload);
  if (user.assignedTeamLeader) broadcastChildStatus(`user:${String(user.assignedTeamLeader)}`, payload);
  broadcastChildStatus('admins', payload);
  return attendance;
};

const markOffline = async (user, req) => {
  const now = new Date();
  const attendance = await ensureAttendanceSession(user, req, now);
  applyDuration(attendance, attendance.lastHeartbeatAt || attendance.loginTime || now, now, attendance.currentState || ACTIVITY_STATES.ACTIVE);
  attendance.logoutTime = now;
  attendance.status = 'CLOSED';
  attendance.currentState = ACTIVITY_STATES.OFFLINE;
  attendance.lastHeartbeatAt = now;
  await attendance.save();
  await User.findByIdAndUpdate(user._id, { onlineStatus: 'offline', currentActivityState: ACTIVITY_STATES.OFFLINE, lastSeen: now });
  return attendance;
};

const startBreak = async ({ user, type = 'Short break', reason = '', req }) => {
  const attendance = await processHeartbeat({ user, state: ACTIVITY_STATES.ON_BREAK, req, metadata: { breakStarted: true } });
  const activeBreak = await Break.findOne({ user: user._id, status: 'OPEN' });
  if (activeBreak) return activeBreak;
  return Break.create({ user: user._id, attendance: attendance._id, type, reason, startTime: new Date() });
};

const endBreak = async ({ user, req }) => {
  const activeBreak = await Break.findOne({ user: user._id, status: 'OPEN' });
  if (activeBreak) {
    activeBreak.endTime = new Date();
    activeBreak.duration = Math.max(0, activeBreak.endTime.getTime() - activeBreak.startTime.getTime());
    activeBreak.status = 'CLOSED';
    await activeBreak.save();
  }
  await processHeartbeat({ user, state: ACTIVITY_STATES.ACTIVE, req, metadata: { breakEnded: true } });
  return activeBreak;
};

module.exports = { ensureAttendanceSession, processHeartbeat, markOffline, startBreak, endBreak };
