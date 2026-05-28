const mongoose = require('mongoose');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Attendance = require('../models/Attendance');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES } = require('../constants/roles');

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) throw new ApiError(403, 'Permission denied');
  next();
};

const checkAdmin = authorizeRoles(ROLES.ADMIN);
const checkHR = authorizeRoles(ROLES.ADMIN, ROLES.HR);
const checkTeamLeader = authorizeRoles(ROLES.ADMIN, ROLES.TEAM_LEADER);
const checkSalesperson = authorizeRoles(ROLES.ADMIN, ROLES.SALESPERSON);

const asObjectId = value => new mongoose.Types.ObjectId(value);
const sameId = (a, b) => String(a || '') === String(b || '');

const buildChildQuery = user => {
  if (user.role === ROLES.ADMIN) return { isActive: true };
  if (user.role === ROLES.HR) return {
    isActive: true,
    _id: { $ne: user._id },
    $or: [{ assignedHR: user._id }, { createdBy: user._id }]
  };
  if (user.role === ROLES.TEAM_LEADER) return {
    isActive: true,
    role: ROLES.SALESPERSON,
    assignedTeamLeader: user._id
  };
  return { _id: user._id, isActive: true };
};

const getAccessibleUserIds = async user => {
  if (user.role === ROLES.ADMIN) {
    const users = await User.find({ isActive: true }).select('_id').lean();
    return users.map(u => u._id);
  }
  if (user.role === ROLES.HR) {
    const users = await User.find(buildChildQuery(user)).select('_id').lean();
    return [user._id, ...users.map(u => u._id)];
  }
  if (user.role === ROLES.TEAM_LEADER) {
    const users = await User.find(buildChildQuery(user)).select('_id').lean();
    return [user._id, ...users.map(u => u._id)];
  }
  return [user._id];
};

const canAccessUser = async (viewer, targetUserId) => {
  if (viewer.role === ROLES.ADMIN) return true;
  if (sameId(viewer._id, targetUserId)) return true;
  const target = await User.findById(targetUserId).select('assignedHR assignedTeamLeader role createdBy').lean();
  if (!target) return false;
  if (viewer.role === ROLES.HR) {
    return sameId(target.assignedHR, viewer._id) || sameId(target.createdBy, viewer._id);
  }
  if (viewer.role === ROLES.TEAM_LEADER) {
    return target.role === ROLES.SALESPERSON && sameId(target.assignedTeamLeader, viewer._id);
  }
  return false;
};

const checkChildEmployeeAccess = asyncHandler(async (req, res, next) => {
  const id = req.params.id || req.params.userId || req.body.userId;
  if (!id) throw new ApiError(400, 'Target user ID is required');
  const allowed = await canAccessUser(req.user, id);
  if (!allowed) throw new ApiError(403, 'You cannot access this employee');
  next();
});

const buildLeadAccessQuery = async user => {
  if (user.role === ROLES.ADMIN) return { isDeleted: false };
  const ids = await getAccessibleUserIds(user);
  if (user.role === ROLES.HR || user.role === ROLES.TEAM_LEADER) {
    return { isDeleted: false, $or: [{ assignedTo: { $in: ids } }, { assignedBy: { $in: ids } }, { createdBy: { $in: ids } }] };
  }
  return { isDeleted: false, $or: [{ assignedTo: user._id }, { createdBy: user._id }] };
};

const canAccessLead = async (user, leadId) => {
  const lead = await Lead.findById(leadId).lean();
  if (!lead || lead.isDeleted) return false;
  if (user.role === ROLES.ADMIN) return true;
  const ids = (await getAccessibleUserIds(user)).map(String);
  return ids.includes(String(lead.assignedTo || '')) || ids.includes(String(lead.assignedBy || '')) || ids.includes(String(lead.createdBy || ''));
};

const checkLeadAccess = asyncHandler(async (req, res, next) => {
  const id = req.params.id;
  if (!id) throw new ApiError(400, 'Lead ID is required');
  if (!(await canAccessLead(req.user, id))) throw new ApiError(403, 'You cannot access this lead');
  next();
});

const checkAttendanceAccess = asyncHandler(async (req, res, next) => {
  const userId = req.params.id || req.params.userId || req.query.userId;
  if (!userId) return next();
  if (!(await canAccessUser(req.user, userId))) throw new ApiError(403, 'You cannot access this attendance');
  next();
});

const ensureCanDeleteLead = asyncHandler(async (req, res, next) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead || lead.isDeleted) throw new ApiError(404, 'Lead not found');
  if (req.user.role === ROLES.ADMIN) return next();
  if (req.user.role !== ROLES.TEAM_LEADER) throw new ApiError(403, 'Only Admin or Team Leader can delete leads');
  const ids = (await getAccessibleUserIds(req.user)).map(String);
  if (!ids.includes(String(lead.assignedTo || '')) && !sameId(lead.assignedBy, req.user._id)) {
    throw new ApiError(403, 'You can delete only your team leads');
  }
  next();
});

module.exports = {
  authorizeRoles,
  checkAdmin,
  checkHR,
  checkTeamLeader,
  checkSalesperson,
  checkChildEmployeeAccess,
  checkLeadAccess,
  checkAttendanceAccess,
  ensureCanDeleteLead,
  buildChildQuery,
  getAccessibleUserIds,
  canAccessUser,
  buildLeadAccessQuery,
  canAccessLead
};
