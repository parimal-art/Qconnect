const Notification = require('../models/Notification');

let ioRef = null;

const setSocketServer = io => {
  ioRef = io;
};

const emitToUser = (userId, event, payload) => {
  if (!ioRef || !userId) return;
  ioRef.to(`user:${String(userId)}`).emit(event, payload);
};

const notifyUser = async ({ user, title, message, type = 'info', metadata = {} }) => {
  const notification = await Notification.create({ user, title, message, type, metadata });
  emitToUser(user, 'new_notification', notification);
  return notification;
};

const notifyMany = async ({ users, title, message, type = 'info', metadata = {} }) => {
  const ids = [...new Set(users.map(String))];
  const docs = await Notification.insertMany(ids.map(user => ({ user, title, message, type, metadata })));
  docs.forEach(doc => emitToUser(doc.user, 'new_notification', doc));
  return docs;
};

const broadcastChildStatus = (parentRoom, payload) => {
  if (!ioRef) return;
  ioRef.to(parentRoom).emit('child_employee_status_updated', payload);
};

module.exports = { setSocketServer, emitToUser, notifyUser, notifyMany, broadcastChildStatus };
