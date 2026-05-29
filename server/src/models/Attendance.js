const mongoose = require('mongoose');
const { ACTIVITY_STATES } = require('../constants/roles');

const HeartbeatLogSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    state: { type: String, enum: Object.values(ACTIVITY_STATES), default: ACTIVITY_STATES.ACTIVE },
    activitySource: { type: String, enum: ['CRM_PWA', 'DESKTOP_TRACKER'], default: 'CRM_PWA' },
    insideShiftMs: { type: Number, default: 0 },
    outsideShiftMs: { type: Number, default: 0 },
    metadata: mongoose.Schema.Types.Mixed
  },
  { _id: false }
);

const LogoutHistorySchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    reason: String
  },
  { _id: false }
);

const AttendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true, index: true },
    shiftStart: { type: String, default: '09:00' },
    shiftEnd: { type: String, default: '19:00' },
    loginTime: Date,
    logoutTime: Date,
    lastLogoutTime: Date,
    totalLoggedInTime: { type: Number, default: 0 },
    totalShiftTime: { type: Number, default: 0 },
    activeTimeInsideShift: { type: Number, default: 0 },
    idleTimeInsideShift: { type: Number, default: 0 },
    breakTimeInsideShift: { type: Number, default: 0 },
    offlineTimeInsideShift: { type: Number, default: 0 },
    activeTimeOutsideShift: { type: Number, default: 0 },
    offlineTimeOutsideShift: { type: Number, default: 0 },
    totalBreakTime: { type: Number, default: 0 },
    totalIdleTime: { type: Number, default: 0 },
    totalOfflineTime: { type: Number, default: 0 },
    productiveLeadTime: { type: Number, default: 0 },
    desktopActiveTimeInsideShift: { type: Number, default: 0 },
    desktopActiveTimeOutsideShift: { type: Number, default: 0 },
    offlineStartedAt: Date,
    heartbeatLogs: [HeartbeatLogSchema],
    logoutHistory: [LogoutHistorySchema],
    status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN', index: true },
    currentState: { type: String, enum: Object.values(ACTIVITY_STATES), default: ACTIVITY_STATES.ACTIVE },
    lastHeartbeatAt: Date,
    lastStateStartedAt: Date,
    deviceInfo: {
      userAgent: String,
      ipAddress: String,
      platform: String
    }
  },
  { timestamps: true }
);

AttendanceSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
