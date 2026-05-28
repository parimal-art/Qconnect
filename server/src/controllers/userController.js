const User = require('../models/User');
const Lead = require('../models/Lead');
const Attendance = require('../models/Attendance');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { createEmployee } = require('../services/userService');
const { buildChildQuery, canAccessUser, getAccessibleUserIds } = require('../middleware/rbac');
const { ROLES, ACTIVITY_STATES } = require('../constants/roles');
const { startOfDay, endOfDay, formatDuration } = require('../utils/time');

const createUser = asyncHandler(async (req, res) => {
  const user = await createEmployee({ creator: req.user, data: req.body });
  res.status(201).json({ success: true, user });
});

const getUsers = asyncHandler(async (req, res) => {
  const query = buildChildQuery(req.user);
  if (req.query.role) query.role = req.query.role;

  const users = await User.find(query)
    .populate('assignedHR', 'name email employeeId hrUniqueId')
    .populate('assignedTeamLeader', 'name email employeeId teamLeaderUniqueId')
    .sort({ createdAt: -1 });

  res.json({ success: true, users });
});

const getChildren = asyncHandler(async (req, res) => {
  const query = buildChildQuery(req.user);
  if (req.user.role === ROLES.ADMIN) query.role = { $ne: ROLES.ADMIN };

  const users = await User.find(query)
    .populate('assignedHR', 'name email employeeId')
    .populate('assignedTeamLeader', 'name email employeeId')
    .sort({ role: 1, name: 1 });

  res.json({ success: true, users });
});

const trackingForChildren = asyncHandler(async (req, res) => {
  const ids = await getAccessibleUserIds(req.user);
  const today = { $gte: startOfDay(), $lte: endOfDay() };

  const userFilter = {
    _id: req.user.role === ROLES.ADMIN ? { $in: ids } : { $in: ids, $ne: req.user._id },
    isActive: true,
    ...(req.user.role === ROLES.ADMIN ? { role: { $ne: ROLES.ADMIN } } : {})
  };

  const users = await User.find(userFilter)
    .populate('assignedHR', 'name email employeeId')
    .populate('assignedTeamLeader', 'name email employeeId')
    .lean();

  const attendances = await Attendance.find({
    user: { $in: users.map(u => u._id) },
    date: today
  }).lean();

  const attendanceByUser = Object.fromEntries(attendances.map(a => [String(a.user), a]));

  const leadAgg = await Lead.aggregate([
    {
      $match: {
        isDeleted: false,
        assignedTo: { $in: users.map(u => u._id) },
        createdAt: today
      }
    },
    {
      $group: {
        _id: '$assignedTo',
        total: { $sum: 1 },
        completed: {
          $sum: {
            $cond: ['$isCompleted', 1, 0]
          }
        },
        followupDue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$followUpDate', null] },
                  { $lte: ['$followUpDate', new Date()] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  const leadByUser = Object.fromEntries(leadAgg.map(l => [String(l._id), l]));

  const data = users.map(user => {
    const attendance = attendanceByUser[String(user._id)] || {};
    const leads = leadByUser[String(user._id)] || { total: 0, completed: 0, followupDue: 0 };
    const pending = Math.max(0, (leads.total || 0) - (leads.completed || 0));
    const performancePercentage = leads.total ? Math.round((leads.completed / leads.total) * 100) : 0;

    return {
      userId: user._id,
      employeeName: user.name || user.email,
      employeeId: user.employeeId,
      role: user.role,
      assignedParentName: user.assignedTeamLeader?.name || user.assignedHR?.name || 'Admin',
      onlineStatus: user.onlineStatus,
      currentActivityState: user.currentActivityState,
      loginTime: attendance.loginTime,
      logoutTime: attendance.logoutTime,
      assignedWorkingHours: `${user.shiftStart} - ${user.shiftEnd}`,
      totalShiftDuration: formatDuration(attendance.totalShiftTime || 0),
      totalActiveTimeDuringWorkingHours: formatDuration(attendance.activeTimeInsideShift || 0),
      totalIdleTimeDuringWorkingHours: formatDuration(attendance.idleTimeInsideShift || 0),
      totalBreakTime: formatDuration(attendance.totalBreakTime || 0),
      outOfShiftActivityTime: formatDuration(attendance.activeTimeOutsideShift || 0),
      lastSeen: user.lastSeen,
      todaysLeadCount: leads.total || 0,
      completedLeadCount: leads.completed || 0,
      pendingLeadCount: pending,
      followUpDueCount: leads.followupDue || 0,
      performancePercentage
    };
  });

  res.json({ success: true, data });
});

const getUserById = asyncHandler(async (req, res) => {
  if (!(await canAccessUser(req.user, req.params.id))) {
    throw new ApiError(403, 'Access denied');
  }

  const user = await User.findById(req.params.id)
    .populate('assignedHR', 'name email employeeId')
    .populate('assignedTeamLeader', 'name email employeeId');

  if (!user) throw new ApiError(404, 'User not found');

  res.json({ success: true, user });
});

const updateUser = asyncHandler(async (req, res) => {
  if (!(await canAccessUser(req.user, req.params.id))) {
    throw new ApiError(403, 'Access denied');
  }

  const protectedFields = ['password', 'role', 'employeeId', 'createdBy', 'tokenVersion'];
  protectedFields.forEach(f => delete req.body[f]);

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');

  Object.assign(user, req.body);
  user.calculateProfileCompletion();

  if (user.profileCompletionPercentage < 100) user.isVerified = false;

  await user.save();

  res.json({ success: true, user });
});

const deleteUser = asyncHandler(async (req, res) => {
  if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.HR) {
    throw new ApiError(403, 'Access denied');
  }

  if (!(await canAccessUser(req.user, req.params.id))) {
    throw new ApiError(403, 'Access denied');
  }

  await User.findByIdAndUpdate(req.params.id, {
    isActive: false,
    onlineStatus: 'offline',
    currentActivityState: ACTIVITY_STATES.OFFLINE
  });

  res.json({ success: true, message: 'Employee deactivated' });
});

const verifyUser = asyncHandler(async (req, res) => {
  if (![ROLES.ADMIN, ROLES.HR].includes(req.user.role)) {
    throw new ApiError(403, 'Only Admin/HR can verify profiles');
  }

  if (!(await canAccessUser(req.user, req.params.id))) {
    throw new ApiError(403, 'Access denied');
  }

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');

  user.calculateProfileCompletion();

  if (user.profileCompletionPercentage < 100) {
    throw new ApiError(400, `Profile incomplete: ${user.pendingRequiredFields.join(', ')}`);
  }

  user.isVerified = true;
  user.verifiedBy = req.user._id;
  user.verifiedAt = new Date();

  await user.save();

  res.json({ success: true, user });
});

const completeProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(404, 'User not found');

  const allowedGenderValues = ['Male', 'Female', 'Other', 'Prefer not to say'];

  const normalizedBody = Object.fromEntries(
    Object.entries(req.body || {})
      .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
  );

  if (normalizedBody.gender && !allowedGenderValues.includes(normalizedBody.gender)) {
    throw new ApiError(400, `Gender must be one of: ${allowedGenderValues.join(', ')}`);
  }

  const fileMap = Object.fromEntries(
    (req.files || []).map(file => [file.fieldname, `/uploads/${file.filename}`])
  );

  Object.assign(user, normalizedBody, fileMap);

  if (req.body.documents) {
    let docs = [];

    try {
      docs = Array.isArray(req.body.documents)
        ? req.body.documents
        : JSON.parse(req.body.documents || '[]');
    } catch {
      throw new ApiError(400, 'Invalid documents payload');
    }

    user.documents.push(...docs);
  }

  user.calculateProfileCompletion();

  await user.save();

  res.json({ success: true, user });
});

const userActivity = asyncHandler(async (req, res) => {
  if (!(await canAccessUser(req.user, req.params.id))) {
    throw new ApiError(403, 'Access denied');
  }

  const attendance = await Attendance.find({ user: req.params.id })
    .sort({ date: -1 })
    .limit(30)
    .lean();

  const leads = await Lead.find({
    $or: [{ assignedTo: req.params.id }, { createdBy: req.params.id }],
    isDeleted: false
  })
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean();

  res.json({ success: true, attendance, leads });
});

module.exports = {
  createUser,
  getUsers,
  getChildren,
  trackingForChildren,
  getUserById,
  updateUser,
  deleteUser,
  verifyUser,
  completeProfile,
  userActivity
};