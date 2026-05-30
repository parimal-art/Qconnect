const Lead = require('../models/Lead');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { createLead, parseLeadUpload, validateAssignment } = require('../services/leadService');
const { buildLeadAccessQuery, canAccessLead } = require('../middleware/rbac');
const { hydrateLeadNormalizers, buildDuplicateQuery } = require('../utils/leadDuplicate');
const { notifyUser, notifyMany } = require('../services/notificationService');
const { ROLES } = require('../constants/roles');

const MANAGEMENT_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.TEAM_LEADER];

const MANAGER_EDIT_FIELDS = [
  'name',
  'companyName',
  'contactNumber',
  'email',
  'website',
  'domain',
  'address',
  'source',
  'additionalInfo',
  'assignedTo'
];

const SALESPERSON_AFTER_CALL_FIELDS = [
  'leadType',
  'pipelineStatus',
  'callStatus',
  'actionRequired',
  'remarks',
  'followUpDate'
];

const canSalespersonModifyLead = (user, lead) =>
  user.role === ROLES.SALESPERSON &&
  (String(lead.assignedTo || '') === String(user._id) ||
    String(lead.createdBy || '') === String(user._id));

const pickAllowedFields = (source, allowed) => {
  const output = {};

  allowed.forEach(key => {
    if (source[key] !== undefined) {
      output[key] = source[key] === '' ? undefined : source[key];
    }
  });

  return output;
};

const uniqueIds = ids => [...new Set(ids.filter(Boolean).map(String))];

const getLeadManagerRecipients = async lead => {
  const ids = [];
  const assignedTo = lead.assignedTo ? await User.findById(lead.assignedTo).select('assignedTeamLeader assignedHR').lean() : null;

  if (assignedTo?.assignedTeamLeader) ids.push(assignedTo.assignedTeamLeader);
  if (assignedTo?.assignedHR) ids.push(assignedTo.assignedHR);
  if (lead.assignedBy) ids.push(lead.assignedBy);

  const superAdmins = await User.find({ role: ROLES.SUPER_ADMIN, isActive: true }).select('_id').lean();
  ids.push(...superAdmins.map(admin => admin._id));

  return uniqueIds(ids);
};

const notifyManagersAboutWonLead = async ({ req, lead }) => {
  if (lead.pipelineStatus !== 'Won') return;

  const users = await getLeadManagerRecipients(lead);
  if (!users.length) return;

  await notifyMany({
    users,
    title: 'Won lead pending final deal review',
    message: `${lead.name} was marked Won by salesperson. Please verify/finalize the deal amount and generate quotation.`,
    type: 'lead_won_pending_finalization',
    metadata: { leadId: lead._id, userId: lead.assignedTo }
  });

  req.app.get('io')?.emit('lead_won_pending_finalization', { leadId: lead._id });
};

const create = asyncHandler(async (req, res) => {
  if (![...MANAGEMENT_ROLES, ROLES.SALESPERSON].includes(req.user.role)) {
    throw new ApiError(403, 'You are not allowed to create leads');
  }

  const lead = await createLead({
    actor: req.user,
    data: req.body
  });

  res.status(201).json({
    success: true,
    lead
  });
});

const upload = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'CSV or Excel file is required');
  }

  if (!MANAGEMENT_ROLES.includes(req.user.role)) {
    throw new ApiError(403, 'Only Super Admin, Admin, HR, and Team Leader can upload leads');
  }

  const rows = parseLeadUpload(req.file);
  const created = [];

  for (const row of rows) {
    if (!row.name) continue;

    created.push(
      await createLead({
        actor: req.user,
        data: {
          ...row,
          assignedTo: req.body.assignedTo || row.assignedTo
        }
      })
    );
  }

  res.status(201).json({
    success: true,
    count: created.length,
    leads: created
  });
});

const list = asyncHandler(async (req, res) => {
  const access = await buildLeadAccessQuery(req.user);
  const query = { ...access };

  ['leadType', 'pipelineStatus', 'callStatus', 'source', 'assignedTo', 'finalizationStatus'].forEach(key => {
    if (req.query[key]) query[key] = req.query[key];
  });

  if (req.query.completed === 'true') query.isCompleted = true;
  if (req.query.completed === 'false') query.isCompleted = false;

  if (req.query.from || req.query.to) query.createdAt = {};
  if (req.query.from) query.createdAt.$gte = new Date(req.query.from);
  if (req.query.to) query.createdAt.$lte = new Date(req.query.to);

  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Number(req.query.limit || 25));

  const [leads, total] = await Promise.all([
    Lead.find(query)
      .populate('assignedTo', 'name email employeeId assignedTeamLeader assignedHR')
      .populate('assignedBy', 'name email employeeId')
      .populate('createdBy', 'name email employeeId role')
      .populate('finalizedBy', 'name email employeeId role')
      .populate('quotations', 'quotationNo totalAmount status createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Lead.countDocuments(query)
  ]);

  res.json({
    success: true,
    leads,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

const getById = asyncHandler(async (req, res) => {
  if (!(await canAccessLead(req.user, req.params.id))) {
    throw new ApiError(403, 'Access denied');
  }

  const lead = await Lead.findById(req.params.id)
    .populate('assignedTo assignedBy createdBy finalizedBy', 'name email employeeId role')
    .populate('quotations', 'quotationNo totalAmount status createdAt')
    .populate('duplicateWarning.possibleDuplicates', 'leadId name companyName contactNumber email website');

  if (!lead) throw new ApiError(404, 'Lead not found');

  res.json({
    success: true,
    lead
  });
});

const update = asyncHandler(async (req, res) => {
  if (!(await canAccessLead(req.user, req.params.id))) {
    throw new ApiError(403, 'Access denied');
  }

  const lead = await Lead.findById(req.params.id);

  if (!lead || lead.isDeleted) {
    throw new ApiError(404, 'Lead not found');
  }

  let allowedFields = [];
  let timelineAction = '';

  if (MANAGEMENT_ROLES.includes(req.user.role)) {
    allowedFields = MANAGER_EDIT_FIELDS;
    timelineAction = 'Lead management updated';

    if (req.body.assignedTo) {
      await validateAssignment({
        actor: req.user,
        assignedTo: req.body.assignedTo
      });
    }
  }

  if (req.user.role === ROLES.SALESPERSON) {
    if (!canSalespersonModifyLead(req.user, lead)) {
      throw new ApiError(403, 'Salesperson can update only own assigned/self-generated leads');
    }

    allowedFields = SALESPERSON_AFTER_CALL_FIELDS;
    timelineAction = 'After-call data updated';

    if (req.body.assignedTo) {
      delete req.body.assignedTo;
    }
  }

  if (!allowedFields.length) {
    throw new ApiError(403, 'You are not allowed to update this lead');
  }

  const updateData = pickAllowedFields(req.body, allowedFields);

  Object.assign(lead, updateData);

  if (req.user.role === ROLES.SALESPERSON && updateData.pipelineStatus === 'Won') {
    lead.finalizationStatus = 'pending_tl_review';
  }

  hydrateLeadNormalizers(lead);

  lead.activityTimeline.push({
    action: timelineAction,
    description:
      req.user.role === ROLES.SALESPERSON
        ? 'Salesperson updated call details, remarks, follow-up, or pipeline'
        : 'Lead basic details or assignment updated',
    by: req.user._id,
    metadata: updateData
  });

  await lead.save();

  if (updateData.assignedTo) {
    await notifyUser({
      user: updateData.assignedTo,
      title: 'New lead assigned',
      message: `${lead.name} was assigned to you`,
      type: 'lead_assigned',
      metadata: { leadId: lead._id }
    });
  }

  if (req.user.role === ROLES.SALESPERSON && updateData.pipelineStatus === 'Won') {
    await notifyManagersAboutWonLead({ req, lead });
  }

  req.app.get('io')?.emit('lead_updated', {
    leadId: lead._id,
    lead
  });

  res.json({
    success: true,
    lead
  });
});

const updateStatus = asyncHandler(async (req, res) => {
  if (!(await canAccessLead(req.user, req.params.id))) {
    throw new ApiError(403, 'Access denied');
  }

  const lead = await Lead.findById(req.params.id);

  if (!lead || lead.isDeleted) {
    throw new ApiError(404, 'Lead not found');
  }

  if (!canSalespersonModifyLead(req.user, lead)) {
    throw new ApiError(403, 'Only assigned Salesperson can update after-call lead data');
  }

  const updateData = pickAllowedFields(req.body, SALESPERSON_AFTER_CALL_FIELDS);

  Object.assign(lead, updateData);

  if (updateData.pipelineStatus === 'Won') {
    lead.finalizationStatus = 'pending_tl_review';
  }

  lead.activityTimeline.push({
    action: 'After-call status changed',
    description: 'Salesperson updated call status, lead type, action, follow-up, remarks, or pipeline',
    by: req.user._id,
    metadata: updateData
  });

  await lead.save();

  if (updateData.pipelineStatus === 'Won') {
    await notifyManagersAboutWonLead({ req, lead });
  }

  req.app.get('io')?.emit('lead_status_changed', {
    leadId: lead._id,
    lead
  });

  res.json({
    success: true,
    lead
  });
});

const complete = asyncHandler(async (req, res) => {
  if (!(await canAccessLead(req.user, req.params.id))) {
    throw new ApiError(403, 'Access denied');
  }

  const lead = await Lead.findById(req.params.id);

  if (!lead || lead.isDeleted) {
    throw new ApiError(404, 'Lead not found');
  }

  if (!canSalespersonModifyLead(req.user, lead)) {
    throw new ApiError(403, 'Only assigned Salesperson can complete a lead');
  }

  lead.isCompleted = true;
  lead.completedAt = new Date();

  const updateData = pickAllowedFields(req.body, SALESPERSON_AFTER_CALL_FIELDS);
  Object.assign(lead, updateData);

  if (!lead.pipelineStatus) {
    lead.pipelineStatus = 'Won';
  }

  if (lead.pipelineStatus === 'Won') {
    lead.finalizationStatus = 'pending_tl_review';
  }

  lead.activityTimeline.push({
    action: 'Lead completed',
    description: `Lead marked completed as ${lead.pipelineStatus}`,
    by: req.user._id,
    metadata: updateData
  });

  await lead.save();

  if (lead.pipelineStatus === 'Won') {
    await notifyManagersAboutWonLead({ req, lead });
  }

  req.app.get('io')?.emit('lead_completed', {
    leadId: lead._id,
    lead
  });

  res.json({
    success: true,
    lead
  });
});

const finalizeDeal = asyncHandler(async (req, res) => {
  if (!MANAGEMENT_ROLES.includes(req.user.role)) {
    throw new ApiError(403, 'Only Team Leader, HR, Admin, or Super Admin can finalize deal amount');
  }

  if (!(await canAccessLead(req.user, req.params.id))) {
    throw new ApiError(403, 'Access denied');
  }

  const lead = await Lead.findById(req.params.id);
  if (!lead || lead.isDeleted) throw new ApiError(404, 'Lead not found');

  const finalAmount = Number(req.body.finalAmount ?? req.body.amount ?? lead.finalizedAmount ?? 0);
  if (!Number.isFinite(finalAmount) || finalAmount < 0) {
    throw new ApiError(400, 'Valid final amount is required');
  }

  const status = req.body.status === 'rejected' ? 'rejected' : 'finalized';

  lead.pipelineStatus = status === 'finalized' ? 'Won' : lead.pipelineStatus;
  lead.isCompleted = status === 'finalized' ? true : lead.isCompleted;
  lead.completedAt = lead.completedAt || new Date();
  lead.finalizationStatus = status;
  lead.finalizedAmount = status === 'finalized' ? finalAmount : 0;
  lead.finalizedBy = req.user._id;
  lead.finalizedAt = new Date();
  lead.finalizationNotes = req.body.notes || '';

  lead.activityTimeline.push({
    action: status === 'finalized' ? 'Deal finalized' : 'Deal finalization rejected',
    description:
      status === 'finalized'
        ? `Deal finalized with amount ₹${finalAmount.toLocaleString('en-IN')}`
        : 'Won lead was rejected during final review',
    by: req.user._id,
    metadata: { finalAmount, notes: req.body.notes || '' }
  });

  await lead.save();

  if (lead.assignedTo) {
    await notifyUser({
      user: lead.assignedTo,
      title: status === 'finalized' ? 'Deal finalized' : 'Won lead rejected',
      message:
        status === 'finalized'
          ? `${lead.name} was finalized for ₹${finalAmount.toLocaleString('en-IN')}. Your sales target has been updated.`
          : `${lead.name} was rejected during final deal review.`,
      type: status === 'finalized' ? 'deal_finalized' : 'deal_rejected',
      metadata: { leadId: lead._id, userId: lead.assignedTo }
    });
  }

  req.app.get('io')?.emit('deal_finalization_updated', {
    leadId: lead._id,
    finalizationStatus: lead.finalizationStatus,
    finalizedAmount: lead.finalizedAmount
  });

  res.json({ success: true, lead });
});

const remove = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);

  if (!lead || lead.isDeleted) {
    throw new ApiError(404, 'Lead not found');
  }

  if (![ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEAM_LEADER].includes(req.user.role)) {
    throw new ApiError(403, 'Only Super Admin, Admin or Team Leader can delete leads');
  }

  if (!(await canAccessLead(req.user, req.params.id))) {
    throw new ApiError(403, 'Access denied');
  }

  lead.isDeleted = true;
  lead.deletedAt = new Date();
  lead.deletedBy = req.user._id;

  lead.activityTimeline.push({
    action: 'Lead deleted',
    description: 'Lead soft deleted',
    by: req.user._id
  });

  await lead.save();

  res.json({
    success: true,
    message: 'Lead deleted'
  });
});

const search = asyncHandler(async (req, res) => {
  const access = await buildLeadAccessQuery(req.user);
  const q = String(req.query.q || '').trim();

  const query = q
    ? {
        ...access,
        $text: { $search: q }
      }
    : access;

  const leads = await Lead.find(query)
    .sort(q ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
    .limit(50)
    .populate('assignedTo', 'name employeeId email')
    .populate('assignedBy', 'name employeeId email')
    .populate('createdBy', 'name employeeId email role')
    .populate('quotations', 'quotationNo totalAmount status createdAt');

  res.json({
    success: true,
    leads
  });
});

const checkDuplicate = asyncHandler(async (req, res) => {
  const lead = hydrateLeadNormalizers({ ...req.body });
  const query = buildDuplicateQuery(lead);

  const duplicates = query
    ? await Lead.find(query)
        .limit(10)
        .select('leadId name companyName contactNumber email website assignedTo')
    : [];

  res.json({
    success: true,
    hasDuplicate: duplicates.length > 0,
    duplicates
  });
});

const addTimeline = asyncHandler(async (req, res) => {
  if (!(await canAccessLead(req.user, req.params.id))) {
    throw new ApiError(403, 'Access denied');
  }

  const lead = await Lead.findById(req.params.id);

  if (!lead || lead.isDeleted) {
    throw new ApiError(404, 'Lead not found');
  }

  lead.activityTimeline.push({
    action: req.body.action || 'Comment added',
    description: req.body.description,
    by: req.user._id,
    metadata: req.body.metadata
  });

  await lead.save();

  res.status(201).json({
    success: true,
    timeline: lead.activityTimeline
  });
});

module.exports = {
  create,
  upload,
  list,
  getById,
  update,
  updateStatus,
  complete,
  finalizeDeal,
  remove,
  search,
  checkDuplicate,
  addTimeline
};
