const fs = require('fs');
const XLSX = require('xlsx');
const { parse } = require('csv-parse/sync');
const Lead = require('../models/Lead');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { generateLeadId } = require('../utils/ids');
const { buildDuplicateQuery, hydrateLeadNormalizers } = require('../utils/leadDuplicate');
const { ROLES } = require('../constants/roles');
const { canAccessUser } = require('../middleware/rbac');
const { notifyUser } = require('./notificationService');

const mapLeadRow = row => ({
  name: row.name || row.Name || row.leadName || row['Lead Name'],
  companyName: row.companyName || row.Company || row['Company name'] || row.company,
  contactNumber: row.contactNumber || row.phone || row.Phone || row.mobile || row['Contact number'],
  email: row.email || row.Email,
  website: row.website || row.Website,
  domain: row.domain || row.Domain,
  address: row.address || row.Address,
  source: row.source || row.Source || 'Upload',
  additionalInfo: row.additionalInfo || row['Additional info'] || '',
  leadType: row.leadType || row['Lead type'] || 'Cold Lead',
  pipelineStatus: row.pipelineStatus || row['Pipeline status'] || 'New Lead',
  callStatus: row.callStatus || row['Call status'] || null,
  actionRequired: row.actionRequired || row['Action required'] || 'Follow-up',
  followUpDate: row.followUpDate || row['Follow-up date'] || undefined,
  remarks: row.remarks || row.Remarks || ''
});

const parseLeadUpload = file => {
  const buffer = fs.readFileSync(file.path);
  if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
    return parse(buffer, { columns: true, skip_empty_lines: true }).map(mapLeadRow);
  }
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet).map(mapLeadRow);
};

const validateAssignment = async ({ actor, assignedTo }) => {
  if (!assignedTo) return null;
  const salesperson = await User.findOne({ _id: assignedTo, role: ROLES.SALESPERSON, isActive: true });
  if (!salesperson) throw new ApiError(400, 'Assigned salesperson not found');
  if (actor.role === ROLES.ADMIN && !(await canAccessUser(actor, salesperson._id))) {
    throw new ApiError(403, 'You can assign leads only to salespersons inside your admin scope');
  }
  if (actor.role === ROLES.TEAM_LEADER && String(salesperson.assignedTeamLeader) !== String(actor._id)) {
    throw new ApiError(403, 'You can assign only your own salespersons');
  }
  if (actor.role === ROLES.HR && String(salesperson.assignedHR) !== String(actor._id)) {
    throw new ApiError(403, 'You can assign only employees under your HR');
  }
  if (actor.role === ROLES.SALESPERSON && String(salesperson._id) !== String(actor._id)) {
    throw new ApiError(403, 'Salesperson can create only self-generated own leads');
  }
  return salesperson;
};

const createLead = async ({ actor, data }) => {
  if (actor.role === ROLES.SALESPERSON) {
    data.assignedTo = actor._id;
    data.isSelfGenerated = true;
    data.rewardEligible = true;
  }
  const assignedUser = await validateAssignment({ actor, assignedTo: data.assignedTo });
  const lead = new Lead({
    ...data,
    leadId: await generateLeadId(),
    assignedBy: data.assignedTo ? actor._id : undefined,
    createdBy: actor._id,
    rewardEligible: Boolean(data.isSelfGenerated || data.rewardEligible)
  });
  hydrateLeadNormalizers(lead);
  const duplicateQuery = buildDuplicateQuery(lead);
  if (duplicateQuery) {
    const possible = await Lead.find(duplicateQuery).limit(5).select('_id leadId name companyName contactNumber email website');
    if (possible.length) {
      lead.duplicateWarning = { hasDuplicate: true, possibleDuplicates: possible.map(p => p._id), decision: 'pending' };
      lead.duplicateOf = possible[0]._id;
    }
  }
  lead.activityTimeline.push({ action: 'Lead created', description: 'Lead created', by: actor._id });
  if (lead.assignedTo) lead.activityTimeline.push({ action: 'Lead assigned', description: `Assigned to ${assignedUser?.name || assignedUser?.email}`, by: actor._id });
  await lead.save();
  if (lead.assignedTo) {
    await notifyUser({ user: lead.assignedTo, title: 'New lead assigned', message: `${lead.name} has been assigned to you`, type: 'lead_assigned', metadata: { leadId: lead._id } });
  }
  return lead;
};

module.exports = { createLead, parseLeadUpload, validateAssignment };
