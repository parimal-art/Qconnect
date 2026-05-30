const mongoose = require('mongoose');
const { LEAD_PIPELINE } = require('../constants/roles');

const TimelineSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    description: String,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    metadata: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const LeadSchema = new mongoose.Schema(
  {
    leadId: { type: String, unique: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    nameNormalized: { type: String, index: true },
    companyName: { type: String, trim: true, index: true },
    companyNameNormalized: { type: String, index: true },
    contactNumber: { type: String, trim: true, index: true },
    contactNumberNormalized: { type: String, index: true },
    email: { type: String, lowercase: true, trim: true, index: true },
    emailNormalized: { type: String, index: true },
    website: { type: String, trim: true, index: true },
    websiteNormalized: { type: String, index: true },
    domain: String,
    address: String,
    source: { type: String, default: 'Manual', index: true },
    additionalInfo: String,
    leadType: {
      type: String,
      enum: ['Hot Lead', 'Mid Lead', 'Cold Lead'],
      default: 'Cold Lead',
      index: true
    },
    pipelineStatus: {
      type: String,
      enum: LEAD_PIPELINE,
      default: 'New Lead',
      index: true
    },
    callStatus: {
      type: String,
      enum: ['Received', 'Rejected', 'Not received', 'Wrong number', 'Switched off', 'Call back later', null],
      default: null,
      index: true
    },
    actionRequired: {
      type: String,
      enum: ['Follow-up', 'Demo required', 'Send proposal', 'No action', 'Close lead'],
      default: 'Follow-up'
    },
    remarks: String,
    followUpDate: { type: Date, index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isSelfGenerated: { type: Boolean, default: false, index: true },
    rewardEligible: { type: Boolean, default: false, index: true },
    isCompleted: { type: Boolean, default: false, index: true },
    completedAt: Date,

    finalizationStatus: {
      type: String,
      enum: ['not_requested', 'pending_tl_review', 'finalized', 'rejected'],
      default: 'not_requested',
      index: true
    },
    finalizedAmount: { type: Number, default: 0, min: 0 },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    finalizedAt: Date,
    finalizationNotes: String,
    quotations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' }],

    duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    duplicateWarning: {
      hasDuplicate: { type: Boolean, default: false },
      possibleDuplicates: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }],
      decision: { type: String, enum: ['pending', 'ignored', 'merged', 'rejected', null], default: null }
    },
    activityTimeline: [TimelineSchema],
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
    isDeleted: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

LeadSchema.index({ name: 'text', companyName: 'text', contactNumber: 'text', email: 'text', website: 'text', domain: 'text' });
LeadSchema.index({ assignedTo: 1, createdAt: -1 });
LeadSchema.index({ assignedBy: 1, createdAt: -1 });
LeadSchema.index({ pipelineStatus: 1, finalizationStatus: 1, finalizedAt: -1 });

module.exports = mongoose.model('Lead', LeadSchema);
