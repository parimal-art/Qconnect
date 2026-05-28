const Break = require('../models/Break');
const asyncHandler = require('../utils/asyncHandler');
const { startBreak, endBreak } = require('../services/trackingService');
const { getAccessibleUserIds } = require('../middleware/rbac');

const start = asyncHandler(async (req, res) => {
  const record = await startBreak({ user: req.user, type: req.body.type, reason: req.body.reason, req });
  req.app.get('io')?.emit('break_started', { userId: req.user._id, break: record });
  res.status(201).json({ success: true, break: record });
});

const end = asyncHandler(async (req, res) => {
  const record = await endBreak({ user: req.user, req });
  req.app.get('io')?.emit('break_ended', { userId: req.user._id, break: record });
  res.json({ success: true, break: record });
});

const report = asyncHandler(async (req, res) => {
  const ids = await getAccessibleUserIds(req.user);
  const data = await Break.find({ user: { $in: ids } }).populate('user', 'name email employeeId role').sort({ startTime: -1 }).limit(500).lean();
  res.json({ success: true, data });
});

module.exports = { start, end, report };
