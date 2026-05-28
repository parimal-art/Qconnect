const ActivityLog = require('../models/ActivityLog');

const createActivityLog = async ({ req, user, action, module, description, metadata }) => ActivityLog.create({
  user: user?._id || user,
  action,
  module,
  description,
  metadata,
  ipAddress: req?.ip,
  userAgent: req?.headers?.['user-agent']
});

module.exports = { createActivityLog };
