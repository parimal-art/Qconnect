const User = require('../models/User');
const Lead = require('../models/Lead');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Break = require('../models/Break');
const { getAccessibleUserIds, buildLeadAccessQuery, canAccessUser } = require('../middleware/rbac');
const { ROLES } = require('../constants/roles');
const { startOfDay, endOfDay } = require('../utils/time');
const ApiError = require('../utils/ApiError');

const dateRange = query => {
  const from = query.from ? new Date(query.from) : startOfDay(new Date());
  const to = query.to ? new Date(query.to) : endOfDay(new Date());
  return { from, to };
};

const dashboardReport = async (user, query = {}) => {
  const ids = await getAccessibleUserIds(user, { includeSelf: false });
  const leadQuery = await buildLeadAccessQuery(user);
  const today = { $gte: startOfDay(), $lte: endOfDay() };

  const employeeScope = {
    _id: { $in: ids },
    isActive: true,
    ...(user.role !== ROLES.SUPER_ADMIN ? { role: { $ne: ROLES.SUPER_ADMIN } } : {})
  };

  const [roleCounts, statusCounts, leadCounts, attendanceTotals, bestSales, childEmployeeCount] = await Promise.all([
    User.aggregate([
      { $match: employeeScope },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]),
    User.aggregate([
      { $match: employeeScope },
      { $group: { _id: '$currentActivityState', count: { $sum: 1 } } }
    ]),
    Lead.aggregate([
      { $match: leadQuery },
      { $group: { _id: { pipelineStatus: '$pipelineStatus', leadType: '$leadType', isCompleted: '$isCompleted' }, count: { $sum: 1 } } }
    ]),
    Attendance.aggregate([
      { $match: { user: { $in: ids }, date: today } },
      { $group: {
        _id: null,
        totalActive: { $sum: '$activeTimeInsideShift' },
        totalIdle: { $sum: '$idleTimeInsideShift' },
        totalBreak: { $sum: '$breakTimeInsideShift' }
      } }
    ]),
    Lead.aggregate([
      { $match: { ...leadQuery, isCompleted: true } },
      { $group: { _id: '$assignedTo', completed: { $sum: 1 } } },
      { $sort: { completed: -1 } },
      { $limit: 1 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $project: { completed: 1, name: '$user.name', email: '$user.email', employeeId: '$user.employeeId' } }
    ]),
    User.countDocuments(employeeScope)
  ]);

  return {
    roleCounts,
    statusCounts,
    leadCounts,
    attendanceTotals: attendanceTotals[0] || {},
    bestSalesperson: bestSales[0] || null,
    childEmployeeCount
  };
};

const leadsReport = async (user, query = {}) => {
  const access = await buildLeadAccessQuery(user);
  const { from, to } = dateRange(query);
  const filters = { ...access, createdAt: { $gte: from, $lte: to } };
  if (query.leadType) filters.leadType = query.leadType;
  if (query.callStatus) filters.callStatus = query.callStatus;
  if (query.pipelineStatus) filters.pipelineStatus = query.pipelineStatus;
  if (query.employee) filters.assignedTo = query.employee;
  return Lead.find(filters).populate('assignedTo', 'name email employeeId').populate('assignedBy', 'name email employeeId').sort({ createdAt: -1 }).lean();
};

const attendanceReport = async (user, query = {}) => {
  let ids;

  if (query.employee) {
    if (!(await canAccessUser(user, query.employee))) {
      throw new ApiError(403, 'You cannot access this employee attendance');
    }

    ids = [query.employee];
  } else {
    ids = await getAccessibleUserIds(user);
  }

  const { from, to } = dateRange(query);
  return Attendance.find({ user: { $in: ids }, date: { $gte: startOfDay(from), $lte: endOfDay(to) } })
    .populate('user', 'name email employeeId role assignedHR assignedTeamLeader')
    .sort({ date: -1 })
    .lean();
};

const teamPerformanceReport = async (user, query = {}) => {
  const ids = await getAccessibleUserIds(user);
  return Lead.aggregate([
    { $match: { assignedTo: { $in: ids }, isDeleted: false } },
    { $group: {
      _id: '$assignedTo',
      total: { $sum: 1 },
      completed: { $sum: { $cond: ['$isCompleted', 1, 0] } },
      won: { $sum: { $cond: [{ $eq: ['$pipelineStatus', 'Won'] }, 1, 0] } },
      lost: { $sum: { $cond: [{ $eq: ['$pipelineStatus', 'Lost'] }, 1, 0] } },
      selfGenerated: { $sum: { $cond: ['$isSelfGenerated', 1, 0] } }
    } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'employee' } },
    { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
    { $project: {
      employee: { _id: '$employee._id', name: '$employee.name', email: '$employee.email', employeeId: '$employee.employeeId', role: '$employee.role' },
      total: 1, completed: 1, won: 1, lost: 1, selfGenerated: 1,
      performancePercentage: { $cond: [{ $eq: ['$total', 0] }, 0, { $round: [{ $multiply: [{ $divide: ['$completed', '$total'] }, 100] }, 0] }] }
    } },
    { $sort: { performancePercentage: -1 } }
  ]);
};

const breakReport = async (user, query = {}) => {
  const ids = await getAccessibleUserIds(user);
  return Break.find({ user: { $in: ids } }).populate('user', 'name email employeeId role').sort({ startTime: -1 }).lean();
};

const leaveReport = async (user, query = {}) => {
  const ids = await getAccessibleUserIds(user);
  return Leave.find({ user: { $in: ids } }).populate('user', 'name email employeeId role').populate('approvedBy', 'name email').sort({ createdAt: -1 }).lean();
};

module.exports = { dashboardReport, leadsReport, attendanceReport, teamPerformanceReport, breakReport, leaveReport };
