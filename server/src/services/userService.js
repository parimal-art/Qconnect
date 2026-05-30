const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { generateEmployeeIds } = require('../utils/ids');
const { sendCredentialsEmail } = require('../utils/email');
const { ROLES } = require('../constants/roles');

const roleCreationPermissions = {
  [ROLES.SUPER_ADMIN]: [ROLES.ADMIN, ROLES.HR, ROLES.TEAM_LEADER, ROLES.SALESPERSON],
  [ROLES.ADMIN]: [ROLES.HR, ROLES.TEAM_LEADER, ROLES.SALESPERSON],
  [ROLES.HR]: [ROLES.TEAM_LEADER, ROLES.SALESPERSON],
  [ROLES.TEAM_LEADER]: [],
  [ROLES.SALESPERSON]: []
};

const assertCanCreateRole = (creator, targetRole) => {
  const allowed = roleCreationPermissions[creator.role] || [];
  if (!allowed.includes(targetRole)) throw new ApiError(403, `You cannot create ${targetRole}`);
};

const resolveAssignments = async ({ creator, role, assignedHR, assignedTeamLeader }) => {
  let hrId = assignedHR;
  let tlId = assignedTeamLeader;

  if (creator.role === ROLES.HR) hrId = creator._id;
  if (creator.role === ROLES.TEAM_LEADER) tlId = creator._id;

  if ([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR].includes(role)) {
    hrId = undefined;
    tlId = undefined;
  }

  if (role === ROLES.TEAM_LEADER) {
    if (!hrId) throw new ApiError(400, 'Assigned HR is required for Team Leader');

    const hrQuery = { _id: hrId, role: ROLES.HR, isActive: true };
    if (creator.role === ROLES.ADMIN) hrQuery.createdBy = creator._id;

    const hr = await User.findOne(hrQuery);
    if (!hr) throw new ApiError(400, 'Assigned HR not found in your scope');
    tlId = undefined;
  }

  if (role === ROLES.SALESPERSON) {
    if (!hrId || !tlId) throw new ApiError(400, 'Assigned HR and Team Leader are required for Salesperson');

    const hrQuery = { _id: hrId, role: ROLES.HR, isActive: true };
    const tlQuery = { _id: tlId, role: ROLES.TEAM_LEADER, isActive: true };

    if (creator.role === ROLES.ADMIN) {
      hrQuery.createdBy = creator._id;
    }

    if (creator.role === ROLES.HR) {
      tlQuery.assignedHR = creator._id;
    }

    const [hr, tl] = await Promise.all([
      User.findOne(hrQuery),
      User.findOne(tlQuery)
    ]);

    if (!hr) throw new ApiError(400, 'Assigned HR not found in your scope');
    if (!tl) throw new ApiError(400, 'Assigned Team Leader not found in your scope');
    if (String(tl.assignedHR) !== String(hr._id)) throw new ApiError(400, 'Team Leader is not under selected HR');
  }

  return { assignedHR: hrId, assignedTeamLeader: tlId };
};

const createEmployee = async ({ creator, data }) => {
  assertCanCreateRole(creator, data.role);

  const exists = await User.findOne({ email: data.email.toLowerCase() });
  if (exists) throw new ApiError(409, 'Email already exists');

  const ids = await generateEmployeeIds(data.role);
  const assignments = await resolveAssignments({
    creator,
    role: data.role,
    assignedHR: data.assignedHR,
    assignedTeamLeader: data.assignedTeamLeader
  });

  const user = new User({
    email: data.email,
    password: data.defaultPassword,
    role: data.role,
    name: data.name,
    shiftStart: data.shiftStart || '09:00',
    shiftEnd: data.shiftEnd || '19:00',
    joiningDate: data.joiningDate || new Date(),
    createdBy: creator._id,
    ...ids,
    ...assignments
  });

  user.calculateProfileCompletion();
  await user.save();
  await sendCredentialsEmail({ to: user.email, password: data.defaultPassword, role: user.role });

  return user.toObject({
    versionKey: false,
    transform: (_, ret) => {
      delete ret.password;
      return ret;
    }
  });
};

module.exports = { createEmployee, resolveAssignments };
