const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const { processHeartbeat, markOffline, startBreak, endBreak } = require('../services/trackingService');
const { setSocketServer } = require('../services/notificationService');
const { ACTIVITY_STATES, ROLES } = require('../constants/roles');

const registerSocket = io => {
  setSocketServer(io);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('Authentication token missing'));
      const payload = jwt.verify(token, env.jwtAccessSecret);
      const user = await User.findById(payload.sub);
      if (!user || !user.isActive) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid socket token'));
    }
  });

  io.on('connection', socket => {
    const user = socket.user;
    socket.join(`user:${String(user._id)}`);
    if ([ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(user.role)) socket.join('admins');
    if (user.assignedHR) socket.join(`user:${String(user.assignedHR)}`);
    if (user.assignedTeamLeader) socket.join(`user:${String(user.assignedTeamLeader)}`);

    processHeartbeat({ user, state: ACTIVITY_STATES.ACTIVE, metadata: { socket: 'connect' } }).catch(console.error);

    socket.on('user_online', payload => processHeartbeat({ user, state: ACTIVITY_STATES.ACTIVE, metadata: payload }).catch(console.error));
    socket.on('heartbeat', payload => processHeartbeat({ user, state: payload?.state || ACTIVITY_STATES.ACTIVE, metadata: payload || {}, activitySource: payload?.activitySource || 'CRM_PWA' }).catch(console.error));
    socket.on('user_active', payload => processHeartbeat({ user, state: ACTIVITY_STATES.ACTIVE, metadata: payload }).catch(console.error));
    socket.on('user_idle', payload => processHeartbeat({ user, state: ACTIVITY_STATES.IDLE, metadata: payload }).catch(console.error));
    socket.on('break_started', payload => startBreak({ user, type: payload?.type, reason: payload?.reason }).catch(console.error));
    socket.on('break_ended', () => endBreak({ user }).catch(console.error));
    socket.on('lead_updated', payload => io.emit('lead_updated', payload));
    socket.on('lead_completed', payload => io.emit('lead_completed', payload));

    socket.on('disconnect', () => {
      markOffline(user).catch(console.error);
    });
  });
};

module.exports = registerSocket;
