const mongoose = require('mongoose');
const validator = require('validator');
const { ROLES, ACTIVITY_STATES } = require('../constants/roles');
const { hashPassword, comparePassword } = require('../utils/password');

const DocumentSchema = new mongoose.Schema({
  label: { type: String, trim: true },
  url: { type: String, trim: true },
  fileName: { type: String, trim: true },
  mimeType: { type: String, trim: true },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: true });

const UserSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: [validator.isEmail, 'Invalid email']
  },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: Object.values(ROLES), required: true, index: true },
  employeeId: { type: String, unique: true, sparse: true, index: true },
  hrUniqueId: { type: String, sparse: true, index: true },
  teamLeaderUniqueId: { type: String, sparse: true, index: true },
  assignedHR: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  assignedTeamLeader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  phone: { type: String, trim: true },
  address: { type: String, trim: true },
  profilePhoto: { type: String, trim: true },
  aadhaarCard: { type: String, trim: true },
  emergencyContactNumber: { type: String, trim: true },
  dateOfBirth: Date,
  gender: { type: String, enum: ['Male', 'Female', 'Other', 'Prefer not to say', null], default: null },
  joiningDate: Date,
  previousCompanyName: String,
  previousCompanyPayslip: String,
  experienceLetter: String,
  panCard: String,
  bankDetails: {
    accountHolderName: String,
    accountNumber: String,
    ifsc: String,
    bankName: String
  },
  documents: [DocumentSchema],
  profileCompletionPercentage: { type: Number, default: 0, min: 0, max: 100 },
  pendingRequiredFields: [{ type: String }],
  isVerified: { type: Boolean, default: false },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
  firstLogin: { type: Boolean, default: true },
  passwordChanged: { type: Boolean, default: false },
  shiftStart: { type: String, default: '09:00' },
  shiftEnd: { type: String, default: '19:00' },
  onlineStatus: { type: String, enum: ['online', 'offline'], default: 'offline', index: true },
  currentActivityState: { type: String, enum: Object.values(ACTIVITY_STATES), default: ACTIVITY_STATES.OFFLINE },
  lastSeen: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true, index: true },
  tokenVersion: { type: Number, default: 0 },
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false }
}, { timestamps: true });

UserSchema.pre('save', async function hashPasswordIfModified(next) {
  if (!this.isModified('password')) return next();
  this.password = await hashPassword(this.password);
  next();
});

UserSchema.methods.comparePassword = function compare(rawPassword) {
  return comparePassword(rawPassword, this.password);
};

const REQUIRED_PROFILE_FIELDS = [
  'name', 'email', 'phone', 'address', 'profilePhoto', 'aadhaarCard',
  'emergencyContactNumber', 'dateOfBirth', 'gender', 'role', 'employeeId', 'joiningDate'
];

UserSchema.methods.calculateProfileCompletion = function calculateProfileCompletion() {
  const required = [...REQUIRED_PROFILE_FIELDS];
  if (this.role === ROLES.SALESPERSON) required.push('assignedTeamLeader');
  if ([ROLES.HR, ROLES.TEAM_LEADER, ROLES.SALESPERSON].includes(this.role)) required.push('assignedHR');
  const pending = required.filter(field => {
    const value = this.get(field);
    return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
  });
  this.pendingRequiredFields = pending;
  this.profileCompletionPercentage = Math.round(((required.length - pending.length) / required.length) * 100);
  return this.profileCompletionPercentage;
};

UserSchema.index({ role: 1, assignedHR: 1, assignedTeamLeader: 1 });

module.exports = mongoose.model('User', UserSchema);
