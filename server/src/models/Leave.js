const mongoose = require('mongoose');

const LeaveSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  leaveType: { type: String, enum: ['Full day', 'Half day', 'Sick leave', 'Casual leave', 'Other'], default: 'Full day' },
  startDate: { type: Date, required: true, index: true },
  endDate: { type: Date, required: true, index: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending', index: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  rejectedReason: String
}, { timestamps: true });

module.exports = mongoose.model('Leave', LeaveSchema);
