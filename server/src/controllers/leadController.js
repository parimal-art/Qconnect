const Lead = require('../models/Lead');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { createLead, parseLeadUpload, validateAssignment } = require('../services/leadService');
const { buildLeadAccessQuery, canAccessLead } = require('../middleware/rbac');
const { hydrateLeadNormalizers, buildDuplicateQuery } = require('../utils/leadDuplicate');
const { notifyUser } = require('../services/notificationService');
const { ROLES } = require('../constants/roles');

const create = asyncHandler(async (req, res) => {
  const lead = await createLead({ actor: req.user, data: req.body });
  res.status(201).json({ success: true, lead });
});

const upload = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'CSV or Excel file is required');
  if (![ROLES.ADMIN, ROLES.TEAM_LEADER, ROLES.HR].includes(req.user.role)) throw new ApiError(403, 'Only Admin/HR/Team Leader can upload leads');
  const rows = parseLeadUpload(req.file);
  const created = [];
  for (const row of rows) {
    if (!row.name) continue;
    created.push(await createLead({ actor: req.user, data: { ...row, assignedTo: req.body.assignedTo || row.assignedTo } }));
  }
  res.status(201).json({ success: true, count: created.length, leads: created });
});

const list = asyncHandler(async (req, res) => {
  const access = await buildLeadAccessQuery(req.user);
  const query = { ...access };
  ['leadType', 'pipelineStatus', 'callStatus', 'source', 'assignedTo'].forEach(key => {
    if (req.query[key]) query[key] = req.query[key];
  });
  if (req.query.from || req.query.to) query.createdAt = {};
  if (req.query.from) query.createdAt.$gte = new Date(req.query.from);
  if (req.query.to) query.createdAt.$lte = new Date(req.query.to);
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Number(req.query.limit || 25));
  const [leads, total] = await Promise.all([
    Lead.find(query).populate('assignedTo', 'name email employeeId').populate('assignedBy', 'name email employeeId').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Lead.countDocuments(query)
  ]);
  res.json({ success: true, leads, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

const getById = asyncHandler(async (req, res) => {
  if (!(await canAccessLead(req.user, req.params.id))) throw new ApiError(403, 'Access denied');
  const lead = await Lead.findById(req.params.id).populate('assignedTo assignedBy createdBy', 'name email employeeId role').populate('duplicateWarning.possibleDuplicates', 'leadId name companyName contactNumber email website');
  if (!lead) throw new ApiError(404, 'Lead not found');
  res.json({ success: true, lead });
});

const update = asyncHandler(async (req, res) => {
  if (!(await canAccessLead(req.user, req.params.id))) throw new ApiError(403, 'Access denied');
  const lead = await Lead.findById(req.params.id);
  if (!lead || lead.isDeleted) throw new ApiError(404, 'Lead not found');
  if (req.body.assignedTo) await validateAssignment({ actor: req.user, assignedTo: req.body.assignedTo });
  Object.assign(lead, req.body);
  hydrateLeadNormalizers(lead);
  lead.activityTimeline.push({ action: 'Lead updated', description: 'Lead details updated', by: req.user._id, metadata: req.body });
  await lead.save();
  if (req.body.assignedTo) await notifyUser({ user: req.body.assignedTo, title: 'Lead assigned/updated', message: `${lead.name} was assigned or updated`, type: 'lead_assigned', metadata: { leadId: lead._id } });
  req.app.get('io')?.emit('lead_updated', { leadId: lead._id, lead });
  res.json({ success: true, lead });
});

const updateStatus = asyncHandler(async (req, res) => {
  if (!(await canAccessLead(req.user, req.params.id))) throw new ApiError(403, 'Access denied');
  const lead = await Lead.findById(req.params.id);
  if (!lead || lead.isDeleted) throw new ApiError(404, 'Lead not found');
  const allowed = ['pipelineStatus', 'callStatus', 'actionRequired', 'followUpDate', 'remarks'];
  allowed.forEach(key => {
    if (req.body[key] !== undefined) lead[key] = req.body[key];
  });
  lead.activityTimeline.push({ action: 'Status changed', description: 'Lead status/call details changed', by: req.user._id, metadata: req.body });
  await lead.save();
  req.app.get('io')?.emit('lead_status_changed', { leadId: lead._id, lead });
  res.json({ success: true, lead });
});

const complete = asyncHandler(async (req, res) => {
  if (!(await canAccessLead(req.user, req.params.id))) throw new ApiError(403, 'Access denied');
  const lead = await Lead.findById(req.params.id);
  if (!lead || lead.isDeleted) throw new ApiError(404, 'Lead not found');
  lead.isCompleted = true;
  lead.completedAt = new Date();
  if (req.body.pipelineStatus) lead.pipelineStatus = req.body.pipelineStatus;
  lead.activityTimeline.push({ action: 'Lead completed', description: `Lead marked completed as ${lead.pipelineStatus}`, by: req.user._id });
  await lead.save();
  req.app.get('io')?.emit('lead_completed', { leadId: lead._id, lead });
  res.json({ success: true, lead });
});

const remove = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead || lead.isDeleted) throw new ApiError(404, 'Lead not found');
  lead.isDeleted = true;
  lead.deletedAt = new Date();
  lead.deletedBy = req.user._id;
  lead.activityTimeline.push({ action: 'Lead deleted', description: 'Lead soft deleted', by: req.user._id });
  await lead.save();
  res.json({ success: true, message: 'Lead deleted' });
});

const search = asyncHandler(async (req, res) => {
  const access = await buildLeadAccessQuery(req.user);
  const q = String(req.query.q || '').trim();
  const query = q ? { ...access, $text: { $search: q } } : access;
  const leads = await Lead.find(query).sort(q ? { score: { $meta: 'textScore' } } : { createdAt: -1 }).limit(50).populate('assignedTo', 'name employeeId email');
  res.json({ success: true, leads });
});

const checkDuplicate = asyncHandler(async (req, res) => {
  const lead = hydrateLeadNormalizers({ ...req.body });
  const query = buildDuplicateQuery(lead);
  const duplicates = query ? await Lead.find(query).limit(10).select('leadId name companyName contactNumber email website assignedTo') : [];
  res.json({ success: true, hasDuplicate: duplicates.length > 0, duplicates });
});

const addTimeline = asyncHandler(async (req, res) => {
  if (!(await canAccessLead(req.user, req.params.id))) throw new ApiError(403, 'Access denied');
  const lead = await Lead.findById(req.params.id);
  if (!lead || lead.isDeleted) throw new ApiError(404, 'Lead not found');
  lead.activityTimeline.push({ action: req.body.action || 'Comment added', description: req.body.description, by: req.user._id, metadata: req.body.metadata });
  await lead.save();
  res.status(201).json({ success: true, timeline: lead.activityTimeline });
});

module.exports = { create, upload, list, getById, update, updateStatus, complete, remove, search, checkDuplicate, addTimeline };
