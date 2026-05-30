const mongoose = require('mongoose');
const User = require('../models/User');
const Lead = require('../models/Lead');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES } = require('../constants/roles');

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    throw new ApiError(403, 'Permission denied');
  }

  next();
};

const checkAdmin = authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN);
const checkHR = authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR);
const checkTeamLeader = authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEAM_LEADER);
const checkSalesperson = authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SALESPERSON);

const sameId = (a, b) => String(a || '') === String(b || '');
const activeFilter = includeInactive => (includeInactive ? {} : { isActive: true });
const uniqueObjectIds = values => [
  ...new Set(values.filter(Boolean).map(value => String(value)))
].map(value => new mongoose.Types.ObjectId(value));

const rolesBelowAdmin = [ROLES.HR, ROLES.TEAM_LEADER, ROLES.SALESPERSON];

const collectAdminManagedIds = async (adminId, options = {}) => {
  const includeInactive = Boolean(options.includeInactive);
  const includeSelf = options.includeSelf !== false;
  const filter = activeFilter(includeInactive);
  const discovered = new Set(includeSelf ? [String(adminId)] : []);
  let frontier = [adminId];

  for (let depth = 0; depth < 8 && frontier.length; depth += 1) {
    const users = await User.find({
      ...filter,
      role: { $in: rolesBelowAdmin },
      $or: [
        { createdBy: { $in: frontier } },
        { assignedHR: { $in: frontier } },
        { assignedTeamLeader: { $in: frontier } }
      ]
    })
      .select('_id')
      .lean();

    const next = [];

    users.forEach(user => {
      const id = String(user._id);

      if (!discovered.has(id)) {
        discovered.add(id);
        next.push(user._id);
      }
    });

    frontier = next;
  }

  return [...discovered].map(id => new mongoose.Types.ObjectId(id));
};

const buildChildQuery = (user, options = {}) => {
  const filter = activeFilter(Boolean(options.includeInactive));

  if (user.role === ROLES.SUPER_ADMIN) {
    return { ...filter, _id: { $ne: user._id }, role: { $ne: ROLES.SUPER_ADMIN } };
  }

  if (user.role === ROLES.ADMIN) {
    return {
      ...filter,
      _id: { $ne: user._id },
      role: { $in: rolesBelowAdmin },
      createdBy: user._id
    };
  }

  if (user.role === ROLES.HR) {
    return {
      ...filter,
      _id: { $ne: user._id },
      $or: [{ assignedHR: user._id }, { createdBy: user._id }]
    };
  }

  if (user.role === ROLES.TEAM_LEADER) {
    return {
      ...filter,
      role: ROLES.SALESPERSON,
      assignedTeamLeader: user._id
    };
  }

  return { ...filter, _id: user._id };
};

const getAccessibleUserIds = async (user, options = {}) => {
  const includeInactive = Boolean(options.includeInactive);
  const includeSelf = options.includeSelf !== false;
  const filter = activeFilter(includeInactive);

  if (user.role === ROLES.SUPER_ADMIN) {
    const users = await User.find({
      ...filter,
      ...(includeSelf ? {} : { _id: { $ne: user._id } })
    })
      .select('_id')
      .lean();

    return users.map(u => u._id);
  }

  if (user.role === ROLES.ADMIN) {
    return collectAdminManagedIds(user._id, { includeInactive, includeSelf });
  }

  if (user.role === ROLES.HR) {
    const users = await User.find(buildChildQuery(user, { includeInactive }))
      .select('_id')
      .lean();
    return includeSelf ? [user._id, ...users.map(u => u._id)] : users.map(u => u._id);
  }

  if (user.role === ROLES.TEAM_LEADER) {
    const users = await User.find(buildChildQuery(user, { includeInactive }))
      .select('_id')
      .lean();
    return includeSelf ? [user._id, ...users.map(u => u._id)] : users.map(u => u._id);
  }

  return includeSelf ? [user._id] : [];
};

const canAccessUser = async (viewer, targetUserId, options = {}) => {
  if (sameId(viewer._id, targetUserId)) return true;

  const target = await User.findById(targetUserId)
    .select('assignedHR assignedTeamLeader role createdBy isActive')
    .lean();

  if (!target) return false;

  if (viewer.role === ROLES.SUPER_ADMIN) {
    return target.role !== ROLES.SUPER_ADMIN || options.allowSuperAdminTarget === true;
  }

  if (viewer.role === ROLES.ADMIN) {
    if ([ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(target.role)) return false;

    const ids = (await getAccessibleUserIds(viewer, { includeInactive: true })).map(String);
    return ids.includes(String(targetUserId));
  }

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
  if (user.role === ROLES.SUPER_ADMIN) return { isDeleted: false };

  const ids = await getAccessibleUserIds(user, { includeInactive: true });

  if ([ROLES.ADMIN, ROLES.HR, ROLES.TEAM_LEADER].includes(user.role)) {
    return {
      isDeleted: false,
      $or: [
        { assignedTo: { $in: ids } },
        { assignedBy: { $in: ids } },
        { createdBy: { $in: ids } }
      ]
    };
  }

  return {
    isDeleted: false,
    $or: [{ assignedTo: user._id }, { createdBy: user._id }]
  };
};

const canAccessLead = async (user, leadId) => {
  const lead = await Lead.findById(leadId).lean();

  if (!lead || lead.isDeleted) return false;
  if (user.role === ROLES.SUPER_ADMIN) return true;

  const ids = (await getAccessibleUserIds(user, { includeInactive: true })).map(String);

  return (
    ids.includes(String(lead.assignedTo || '')) ||
    ids.includes(String(lead.assignedBy || '')) ||
    ids.includes(String(lead.createdBy || ''))
  );
};

const checkLeadAccess = asyncHandler(async (req, res, next) => {
  const id = req.params.id;

  if (!id) throw new ApiError(400, 'Lead ID is required');
  if (!(await canAccessLead(req.user, id))) {
    throw new ApiError(403, 'You cannot access this lead');
  }

  next();
});

const checkAttendanceAccess = asyncHandler(async (req, res, next) => {
  const userId = req.params.id || req.params.userId || req.query.userId;

  if (!userId) return next();

  if (!(await canAccessUser(req.user, userId))) {
    throw new ApiError(403, 'You cannot access this attendance');
  }

  next();
});

const ensureCanDeleteLead = asyncHandler(async (req, res, next) => {
  const lead = await Lead.findById(req.params.id);

  if (!lead || lead.isDeleted) throw new ApiError(404, 'Lead not found');

  if (req.user.role === ROLES.SUPER_ADMIN) return next();

  if (![ROLES.ADMIN, ROLES.TEAM_LEADER].includes(req.user.role)) {
    throw new ApiError(403, 'Only Super Admin, Admin or Team Leader can delete leads');
  }

  if (!(await canAccessLead(req.user, req.params.id))) {
    throw new ApiError(403, 'You can delete only leads inside your access scope');
  }

  if (req.user.role === ROLES.TEAM_LEADER) {
    const ids = (await getAccessibleUserIds(req.user)).map(String);

    if (!ids.includes(String(lead.assignedTo || '')) && !sameId(lead.assignedBy, req.user._id)) {
      throw new ApiError(403, 'You can delete only your team leads');
    }
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
  canAccessLead,
  uniqueObjectIds
};
