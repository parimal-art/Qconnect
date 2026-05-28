const mongoose = require('mongoose');

const BreakSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  attendance: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance' },
  startTime: { type: Date, required: true, default: Date.now },
  endTime: Date,
  reason: String,
  type: { type: String, enum: ['Lunch break', 'Short break', 'Other'], default: 'Short break' },
  duration: { type: Number, default: 0 },
  status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN', index: true }
}, { timestamps: true });

module.exports = mongoose.model('Break', BreakSchema);
