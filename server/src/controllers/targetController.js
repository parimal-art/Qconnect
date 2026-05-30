const mongoose = require('mongoose');
const Target = require('../models/Target');
const User = require('../models/User');
const Lead = require('../models/Lead');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notifyUser } = require('../services/notificationService');
const { ROLES } = require('../constants/roles');
const { canAccessUser, getAccessibleUserIds } = require('../middleware/rbac');

const sameId = (a, b) => String(a || '') === String(b || '');
const number = value => Math.max(0, Number(value || 0));

const monthBounds = query => {
  const now = new Date();
  const start = query.periodStart ? new Date(query.periodStart) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = query.periodEnd ? new Date(query.periodEnd) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new ApiError(400, 'Invalid target period');
  }

  return { start, end };
};

const buildOverlapQuery = (start, end) => ({
  periodStart: { $lte: end },
  periodEnd: { $gte: start },
  status: 'active'
});

const assertCanAssignTarget = (actor, assignee) => {
  if (actor.role === ROLES.ADMIN) return true;

  if (actor.role === ROLES.HR) {
    if (assignee.role !== ROLES.TEAM_LEADER) {
      throw new ApiError(403, 'HR can assign sales targets only to Team Leaders');
    }

    if (!sameId(assignee.assignedHR, actor._id)) {
      throw new ApiError(403, 'You can assign target only to your assigned Team Leaders');
    }

    return true;
  }

  if (actor.role === ROLES.TEAM_LEADER) {
    if (assignee.role !== ROLES.SALESPERSON || !sameId(assignee.assignedTeamLeader, actor._id)) {
      throw new ApiError(403, 'Team Leader can distribute target only to own Salespersons');
    }

    return true;
  }

  throw new ApiError(403, 'You cannot assign targets');
};

const getSalespersonIdsForUser = async user => {
  if (user.role === ROLES.SALESPERSON) return [user._id];

  if (user.role === ROLES.TEAM_LEADER) {
    const salespersons = await User.find({ role: ROLES.SALESPERSON, assignedTeamLeader: user._id, isActive: true })
      .select('_id')
      .lean();
    return salespersons.map(salesperson => salesperson._id);
  }

  if (user.role === ROLES.HR) {
    const salespersons = await User.find({ role: ROLES.SALESPERSON, assignedHR: user._id, isActive: true })
      .select('_id')
      .lean();
    return salespersons.map(salesperson => salesperson._id);
  }

  const salespersons = await User.find({ role: ROLES.SALESPERSON, isActive: true })
    .select('_id')
    .lean();
  return salespersons.map(salesperson => salesperson._id);
};

const getCompletedSalesAmount = async ({ user, start, end }) => {
  const ids = await getSalespersonIdsForUser(user);
  if (!ids.length) return 0;

  const [row] = await Lead.aggregate([
    {
      $match: {
        isDeleted: false,
        assignedTo: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) },
        pipelineStatus: 'Won',
        finalizationStatus: 'finalized',
        finalizedAt: { $gte: start, $lte: end }
      }
    },
    { $group: { _id: null, amount: { $sum: '$finalizedAmount' } } }
  ]);

  return row?.amount || 0;
};

const buildSummaryForUser = async ({ viewer, targetUser, start, end }) => {
  if (!(await canAccessUser(viewer, targetUser._id))) {
    throw new ApiError(403, 'Access denied');
  }

  const overlap = buildOverlapQuery(start, end);

  const [assignedTargets, distributedTargets, completedAmount] = await Promise.all([
    Target.find({ ...overlap, assignedTo: targetUser._id })
      .populate('assignedBy', 'name email employeeId role')
      .sort({ createdAt: -1 })
      .lean(),
    Target.find({ ...overlap, assignedBy: targetUser._id })
      .populate('assignedTo', 'name email employeeId role')
      .sort({ createdAt: -1 })
      .lean(),
    getCompletedSalesAmount({ user: targetUser, start, end })
  ]);

  const assignedTarget = assignedTargets.reduce((sum, target) => sum + number(target.amount), 0);
  const distributedTarget = distributedTargets.reduce((sum, target) => sum + number(target.amount), 0);

  return {
    user: {
      _id: targetUser._id,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      employeeId: targetUser.employeeId
    },
    periodStart: start,
    periodEnd: end,
    assignedTarget,
    distributedTarget,
    completedTarget: completedAmount,
    targetCovered: completedAmount,
    overAchievement: Math.max(0, completedAmount - assignedTarget),
    remainingTarget: Math.max(0, assignedTarget - completedAmount),
    completionPercentage: assignedTarget ? Math.round((completedAmount / assignedTarget) * 100) : 0,
    assignedTargets,
    distributedTargets
  };
};

const mySummary = asyncHandler(async (req, res) => {
  const { start, end } = monthBounds(req.query);
  const targetUser = await User.findById(req.user._id).lean();
  res.json({ success: true, data: await buildSummaryForUser({ viewer: req.user, targetUser, start, end }) });
});

const userSummary = asyncHandler(async (req, res) => {
  const { start, end } = monthBounds(req.query);
  const targetUser = await User.findById(req.params.id).lean();
  if (!targetUser) throw new ApiError(404, 'Employee not found');
  res.json({ success: true, data: await buildSummaryForUser({ viewer: req.user, targetUser, start, end }) });
});

const listTeamTargets = asyncHandler(async (req, res) => {
  const { start, end } = monthBounds(req.query);
  const overlap = buildOverlapQuery(start, end);

  let query = overlap;

  if (req.user.role !== ROLES.ADMIN) {
    const ids = await getAccessibleUserIds(req.user);
    query = {
      ...overlap,
      $or: [{ assignedTo: { $in: ids } }, { assignedBy: { $in: ids } }]
    };
  }

  const targets = await Target.find(query)
    .populate('assignedTo', 'name email employeeId role assignedHR assignedTeamLeader')
    .populate('assignedBy', 'name email employeeId role')
    .sort({ periodStart: -1, createdAt: -1 })
    .lean();

  res.json({ success: true, targets });
});

const assignTarget = asyncHandler(async (req, res) => {
  const { start, end } = monthBounds(req.body);
  const amount = number(req.body.amount);

  if (!amount) throw new ApiError(400, 'Target amount is required');
  if (!req.body.assignedTo) throw new ApiError(400, 'Assigned employee is required');

  const assignee = await User.findById(req.body.assignedTo).lean();
  if (!assignee || !assignee.isActive) throw new ApiError(404, 'Active employee not found');

  assertCanAssignTarget(req.user, assignee);

  const target = await Target.create({
    assignedTo: assignee._id,
    assignedBy: req.user._id,
    amount,
    periodStart: start,
    periodEnd: end,
    notes: req.body.notes || '',
    history: [{ amount, notes: req.body.notes || '', updatedBy: req.user._id }]
  });

  await notifyUser({
    user: assignee._id,
    title: 'New sales target assigned',
    message: `${req.user.name || req.user.email} assigned you a target of ₹${amount}.`,
    type: 'target_assigned',
    metadata: { targetId: target._id, userId: assignee._id }
  });

  res.status(201).json({ success: true, target });
});

const updateTarget = asyncHandler(async (req, res) => {
  const target = await Target.findById(req.params.id).populate('assignedTo');
  if (!target) throw new ApiError(404, 'Target not found');

  const assignee = target.assignedTo;
  const canEdit =
    req.user.role === ROLES.ADMIN ||
    sameId(target.assignedBy, req.user._id) ||
    (req.user.role === ROLES.HR && sameId(assignee.assignedHR, req.user._id)) ||
    (req.user.role === ROLES.TEAM_LEADER && sameId(assignee.assignedTeamLeader, req.user._id));

  if (!canEdit) throw new ApiError(403, 'You cannot edit this target');

  if (req.body.amount !== undefined) target.amount = number(req.body.amount);
  if (req.body.notes !== undefined) target.notes = req.body.notes;
  if (req.body.status !== undefined) target.status = req.body.status;
  if (req.body.periodStart || req.body.periodEnd) {
    const { start, end } = monthBounds({
      periodStart: req.body.periodStart || target.periodStart,
      periodEnd: req.body.periodEnd || target.periodEnd
    });
    target.periodStart = start;
    target.periodEnd = end;
  }

  target.history.push({ amount: target.amount, notes: target.notes, updatedBy: req.user._id });
  await target.save();

  await notifyUser({
    user: assignee._id,
    title: 'Sales target updated',
    message: `Your target was updated to ₹${target.amount}.`,
    type: 'target_updated',
    metadata: { targetId: target._id, userId: assignee._id }
  });

  res.json({ success: true, target });
});

module.exports = {
  mySummary,
  userSummary,
  listTeamTargets,
  assignTarget,
  updateTarget
};
