const User = require('../models/User');
const Lead = require('../models/Lead');

const prefixByRole = {
  ADMIN: 'ADM',
  HR: 'HR',
  TEAM_LEADER: 'TL',
  SALESPERSON: 'EMP'
};

const nextSequence = async (model, field, prefix) => {
  const regex = new RegExp(`^${prefix}-`);
  const latest = await model.findOne({ [field]: regex }).sort({ createdAt: -1 }).select(field).lean();
  let next = 1;
  if (latest && latest[field]) {
    const last = Number(String(latest[field]).split('-').pop());
    if (Number.isFinite(last)) next = last + 1;
  }
  return `${prefix}-${String(next).padStart(5, '0')}`;
};

const generateEmployeeIds = async role => {
  const employeeId = await nextSequence(User, 'employeeId', prefixByRole[role] || 'EMP');
  if (role === 'HR') return { employeeId, hrUniqueId: employeeId };
  if (role === 'TEAM_LEADER') return { employeeId, teamLeaderUniqueId: employeeId };
  return { employeeId };
};

const generateLeadId = async () => nextSequence(Lead, 'leadId', 'LEAD');

module.exports = { generateEmployeeIds, generateLeadId };
