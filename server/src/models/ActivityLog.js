const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  action: { type: String, required: true, index: true },
  module: { type: String, required: true, index: true },
  description: String,
  metadata: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String
}, { timestamps: true });

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
