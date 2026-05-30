const ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  HR: 'HR',
  TEAM_LEADER: 'TEAM_LEADER',
  SALESPERSON: 'SALESPERSON'
});

const ROLE_LABELS = Object.freeze({
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  HR: 'HR',
  TEAM_LEADER: 'Team Leader',
  SALESPERSON: 'Salesperson'
});

const ACTIVITY_STATES = Object.freeze({
  ONLINE: 'Online',
  ACTIVE: 'Active',
  IDLE: 'Idle',
  ON_BREAK: 'On Break',
  OFFLINE: 'Offline'
});

const LEAD_PIPELINE = Object.freeze([
  'New Lead',
  'Contacted',
  'Interested',
  'Follow-up',
  'Demo Scheduled',
  'Negotiation',
  'Won',
  'Lost'
]);

module.exports = { ROLES, ROLE_LABELS, ACTIVITY_STATES, LEAD_PIPELINE };
