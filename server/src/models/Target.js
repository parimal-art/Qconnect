const mongoose = require('mongoose');

const TargetHistorySchema = new mongoose.Schema(
  {
    amount: Number,
    notes: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const TargetSchema = new mongoose.Schema(
  {
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    periodStart: { type: Date, required: true, index: true },
    periodEnd: { type: Date, required: true, index: true },
    notes: { type: String, trim: true },
    status: { type: String, enum: ['active', 'closed'], default: 'active', index: true },
    history: [TargetHistorySchema]
  },
  { timestamps: true }
);

TargetSchema.index({ assignedTo: 1, periodStart: 1, periodEnd: 1 });
TargetSchema.index({ assignedBy: 1, periodStart: 1, periodEnd: 1 });

module.exports = mongoose.model('Target', TargetSchema);
