const User = require('../models/User');
const Lead = require('../models/Lead');
const Attendance = require('../models/Attendance');
const RefreshToken = require('../models/RefreshToken');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { createEmployee } = require('../services/userService');
const { notifyMany, notifyUser } = require('../services/notificationService');
const { uploadToCloudinary } = require('../config/cloudinary');
const { buildChildQuery, canAccessUser, getAccessibleUserIds } = require('../middleware/rbac');
const { ROLES, ACTIVITY_STATES } = require('../constants/roles');
const { startOfDay, endOfDay, formatDuration, splitDurationByShift } = require('../utils/time');

const stateBucketMap = {
  [ACTIVITY_STATES.ACTIVE]: 'active',
  [ACTIVITY_STATES.ONLINE]: 'active',
  [ACTIVITY_STATES.IDLE]: 'idle',
  [ACTIVITY_STATES.ON_BREAK]: 'break',
  [ACTIVITY_STATES.OFFLINE]: 'offline'
};

const REVIEW_STATUSES = ['verified', 'not_verified', 'document_pending'];

const VERIFICATION_GROUPS = {
  new: ['not_submitted'],
  pending: ['pending_review', 'document_pending'],
  completed: ['verified'],
  rejected: ['not_verified']
};

const number = value => Number(value || 0);

const calculateLiveAttendance = attendance => {
  const now = new Date();

  if (!attendance || !attendance._id) {
    return {
      snapshotAt: now,
      activeTimeInsideShiftMs: 0,
      idleTimeInsideShiftMs: 0,
      offlineTimeInsideShiftMs: 0,
      breakTimeInsideShiftMs: 0,
      activeTimeOutsideShiftMs: 0,
      offlineTimeOutsideShiftMs: 0,
      totalBreakTimeMs: 0,
      totalIdleTimeMs: 0,
      totalOfflineTimeMs: 0,
      totalShiftTimeMs: 0
    };
  }

  const live = {
    snapshotAt: now,
    activeTimeInsideShiftMs: number(attendance.activeTimeInsideShift),
    idleTimeInsideShiftMs: number(attendance.idleTimeInsideShift),
    offlineTimeInsideShiftMs: number(attendance.offlineTimeInsideShift),
    breakTimeInsideShiftMs: number(attendance.breakTimeInsideShift),
    activeTimeOutsideShiftMs: number(attendance.activeTimeOutsideShift),
    offlineTimeOutsideShiftMs: number(attendance.offlineTimeOutsideShift),
    totalBreakTimeMs: number(attendance.totalBreakTime),
    totalIdleTimeMs: number(attendance.totalIdleTime),
    totalOfflineTimeMs: number(attendance.totalOfflineTime),
    totalShiftTimeMs: number(attendance.totalShiftTime)
  };

  if (attendance.status === 'OPEN') {
    const from = attendance.lastHeartbeatAt || attendance.lastStateStartedAt || attendance.loginTime;

    if (from) {
      const { insideShiftMs, outsideShiftMs, totalMs } = splitDurationByShift({
        from,
        to: now,
        shiftStart: attendance.shiftStart,
        shiftEnd: attendance.shiftEnd,
        date: attendance.date
      });

      const bucket = stateBucketMap[attendance.currentState] || 'active';

      if (bucket === 'active') {
        live.activeTimeInsideShiftMs += insideShiftMs;
        live.activeTimeOutsideShiftMs += outsideShiftMs;
      }

      if (bucket === 'idle') {
        live.idleTimeInsideShiftMs += insideShiftMs;
        live.totalIdleTimeMs += totalMs;
      }

      if (bucket === 'break') {
        live.breakTimeInsideShiftMs += insideShiftMs;
        live.totalBreakTimeMs += totalMs;
      }
    }
  }

  if (attendance.status === 'CLOSED' && attendance.offlineStartedAt) {
    const { insideShiftMs, outsideShiftMs, totalMs } = splitDurationByShift({
      from: attendance.offlineStartedAt,
      to: now,
      shiftStart: attendance.shiftStart,
      shiftEnd: attendance.shiftEnd,
      date: attendance.date
    });

    live.offlineTimeInsideShiftMs += insideShiftMs;
    live.offlineTimeOutsideShiftMs += outsideShiftMs;
    live.totalOfflineTimeMs += totalMs;
  }

  return live;
};

const uniqueIds = ids => [...new Set(ids.filter(Boolean).map(String))];

const parseJsonArray = value => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getProfileReviewerIds = async employee => {
  const reviewerIds = [];

  const superAdmins = await User.find({ role: ROLES.SUPER_ADMIN, isActive: true }).select('_id').lean();
  reviewerIds.push(...superAdmins.map(admin => admin._id));

  if (employee.assignedTeamLeader) reviewerIds.push(employee.assignedTeamLeader);
  if (employee.assignedHR) reviewerIds.push(employee.assignedHR);
  if (employee.createdBy) reviewerIds.push(employee.createdBy);

  return uniqueIds(reviewerIds).filter(id => String(id) !== String(employee._id));
};

const sendProfileReviewNotification = async ({ req, employee, reason }) => {
  const users = await getProfileReviewerIds(employee);

  if (!users.length) return;

  const title = 'Employee profile needs review';
  const message = `${employee.name || employee.email} ${reason || 'submitted profile details/documents for verification'}.`;

  await notifyMany({
    users,
    title,
    message,
    type: 'profile_review_required',
    metadata: { userId: employee._id, employeeId: employee.employeeId }
  });

  req.app.get('io')?.emit('profile_review_required', {
    userId: employee._id,
    verificationStatus: employee.verificationStatus
  });
};

const normalizeUploadedFiles = files => {
  if (!files) return [];
  if (Array.isArray(files)) return files;

  return Object.values(files).flat().filter(Boolean);
};

const buildEmployeeUploadFolder = user => {
  const safeEmployeeId = String(user.employeeId || user._id || 'employee').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `crm-employee-tracker/employees/${safeEmployeeId}`;
};

const buildAssetPayload = (asset, file) => ({
  url: asset?.secureUrl,
  cloudinaryPublicId: asset?.publicId,
  cloudinaryResourceType: asset?.resourceType,
  mimeType: file.mimetype,
  originalName: file.originalname,
  size: file.size
});

const appendUploadedProfileFiles = async ({ user, files = [], body = {}, actorId }) => {
  const documentNames = parseJsonArray(body.documentNames);
  user.documents = user.documents || [];
  const uploadedFiles = normalizeUploadedFiles(files);
  const folder = buildEmployeeUploadFolder(user);
  let otherDocumentIndex = 0;

  for (const file of uploadedFiles) {
    const asset = await uploadToCloudinary(file, folder);
    const assetPayload = buildAssetPayload(asset, file);

    if (!assetPayload.url) continue;

    if (file.fieldname === 'profilePhoto') {
      user.profilePhoto = assetPayload.url;
      user.profilePhotoPublicId = assetPayload.cloudinaryPublicId;
      continue;
    }

    if (file.fieldname === 'aadhaarCard') {
      user.aadhaarCard = assetPayload.url;
      user.aadhaarCardPublicId = assetPayload.cloudinaryPublicId;
      continue;
    }

    if (file.fieldname === 'previousCompanyPayslip') {
      user.previousCompanyPayslip = assetPayload.url;
      user.previousCompanyPayslipPublicId = assetPayload.cloudinaryPublicId;
      continue;
    }

    if (file.fieldname === 'experienceLetter') {
      user.experienceLetter = assetPayload.url;
      user.experienceLetterPublicId = assetPayload.cloudinaryPublicId;
      continue;
    }

    if (file.fieldname === 'panCardFile') {
      user.panCardFile = assetPayload.url;
      user.panCardFilePublicId = assetPayload.cloudinaryPublicId;
      continue;
    }

    if (file.fieldname === 'otherDocuments' || file.fieldname.startsWith('otherDocuments')) {
      const name = documentNames[otherDocumentIndex] || file.originalname || `Document ${otherDocumentIndex + 1}`;
      otherDocumentIndex += 1;

      user.documents.push({
        documentName: name,
        label: name,
        url: assetPayload.url,
        cloudinaryPublicId: assetPayload.cloudinaryPublicId,
        cloudinaryResourceType: assetPayload.cloudinaryResourceType,
        mimeType: assetPayload.mimeType,
        originalName: assetPayload.originalName,
        size: assetPayload.size,
        uploadedBy: actorId,
        uploadedAt: new Date(),
        status: 'pending_review'
      });
    }
  }

  const existingDocs = parseJsonArray(body.documents);
  existingDocs.forEach(doc => {
    if (!doc?.url) return;
    user.documents.push({
      documentName: doc.documentName || doc.label || 'Document',
      label: doc.label || doc.documentName || 'Document',
      url: doc.url,
      cloudinaryPublicId: doc.cloudinaryPublicId,
      cloudinaryResourceType: doc.cloudinaryResourceType,
      mimeType: doc.mimeType,
      uploadedBy: actorId,
      uploadedAt: new Date(),
      status: 'pending_review'
    });
  });
};

const markProfilePendingReview = user => {
  user.isVerified = false;
  user.verificationStatus = 'pending_review';
  user.verificationNotes = undefined;
  user.verifiedBy = undefined;
  user.verifiedAt = undefined;
  user.lastProfileSubmittedAt = new Date();
};

const createUser = asyncHandler(async (req, res) => {
  const user = await createEmployee({ creator: req.user, data: req.body });
  res.status(201).json({ success: true, user });
});

const getUsers = asyncHandler(async (req, res) => {
  const includeInactive =
    [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR].includes(req.user.role) || req.query.status === 'all';

  const ids = await getAccessibleUserIds(req.user, {
    includeInactive,
    includeSelf: false
  });

  const query = { _id: { $in: ids } };

  if (req.user.role !== ROLES.SUPER_ADMIN) {
    query.role = { $ne: ROLES.SUPER_ADMIN };
  }

  if (req.user.role === ROLES.ADMIN) {
    query.role = { $in: [ROLES.HR, ROLES.TEAM_LEADER, ROLES.SALESPERSON] };
  }

  if (req.query.role && req.query.role !== 'all') {
    query.role = req.query.role;
  }

  if (req.query.status === 'active') {
    query.isActive = true;
  }

  if (req.query.status === 'inactive') {
    query.isActive = false;
  }

  if (req.query.verificationGroup && req.query.verificationGroup !== 'all') {
    const statuses = VERIFICATION_GROUPS[req.query.verificationGroup];

    if (!statuses) {
      throw new ApiError(400, 'Invalid verification group filter');
    }

    query.verificationStatus = { $in: statuses };
  } else if (req.query.verificationStatus && req.query.verificationStatus !== 'all') {
    query.verificationStatus = req.query.verificationStatus;
  }

  const users = await User.find(query)
    .populate('assignedHR', 'name email employeeId hrUniqueId')
    .populate('assignedTeamLeader', 'name email employeeId teamLeaderUniqueId')
    .populate('createdBy', 'name email employeeId role')
    .sort({ isActive: -1, role: 1, updatedAt: -1, createdAt: -1 });

  res.json({ success: true, users });
});

const getChildren = asyncHandler(async (req, res) => {
  const ids = await getAccessibleUserIds(req.user, { includeSelf: false });
  const query = { _id: { $in: ids }, isActive: true };

  if (req.user.role !== ROLES.SUPER_ADMIN) {
    query.role = { $ne: ROLES.SUPER_ADMIN };
  }

  const users = await User.find(query)
    .populate('assignedHR', 'name email employeeId')
    .populate('assignedTeamLeader', 'name email employeeId')
    .populate('createdBy', 'name email employeeId role')
    .sort({ role: 1, name: 1 });

  res.json({ success: true, users });
});

const trackingForChildren = asyncHandler(async (req, res) => {
  const ids = await getAccessibleUserIds(req.user, { includeSelf: false });
  const today = { $gte: startOfDay(), $lte: endOfDay() };

  const userFilter = {
    _id: { $in: ids },
    isActive: true,
    ...(req.user.role !== ROLES.SUPER_ADMIN ? { role: { $ne: ROLES.SUPER_ADMIN } } : {})
  };

  const users = await User.find(userFilter)
    .populate('assignedHR', 'name email employeeId')
    .populate('assignedTeamLeader', 'name email employeeId')
    .populate('createdBy', 'name email employeeId role')
    .lean();

  const attendances = await Attendance.find({
    user: { $in: users.map(u => u._id) },
    date: today
  }).lean();

  const attendanceByUser = Object.fromEntries(
    attendances.map(attendance => [String(attendance.user), attendance])
  );

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

  const leadByUser = Object.fromEntries(leadAgg.map(lead => [String(lead._id), lead]));

  const data = users.map(user => {
    const attendance = attendanceByUser[String(user._id)] || {};
    const live = calculateLiveAttendance(attendance);
    const leads = leadByUser[String(user._id)] || { total: 0, completed: 0, followupDue: 0 };
    const pending = Math.max(0, (leads.total || 0) - (leads.completed || 0));
    const performancePercentage = leads.total ? Math.round((leads.completed / leads.total) * 100) : 0;

    return {
      userId: user._id,
      employeeName: user.name || user.email,
      employeeId: user.employeeId,
      role: user.role,
      assignedParentName: user.assignedTeamLeader?.name || user.assignedHR?.name || user.createdBy?.name || (user.role === ROLES.ADMIN ? 'Super Admin' : 'Admin'),
      onlineStatus: user.onlineStatus,
      currentActivityState: user.currentActivityState,
      verificationStatus: user.verificationStatus,
      loginTime: attendance.loginTime,
      logoutTime: attendance.logoutTime,
      lastHeartbeatAt: attendance.lastHeartbeatAt,
      currentStateStartedAt: attendance.lastStateStartedAt,
      trackerSnapshotAt: live.snapshotAt,
      attendanceStatus: attendance.status || 'CLOSED',
      shiftStart: user.shiftStart,
      shiftEnd: user.shiftEnd,
      assignedWorkingHours: `${user.shiftStart} - ${user.shiftEnd}`,

      totalShiftDuration: formatDuration(live.totalShiftTimeMs),

      activeTimeInsideShiftMs: live.activeTimeInsideShiftMs,
      idleTimeInsideShiftMs: live.idleTimeInsideShiftMs,
      offlineTimeInsideShiftMs: live.offlineTimeInsideShiftMs,
      breakTimeInsideShiftMs: live.breakTimeInsideShiftMs,
      activeTimeOutsideShiftMs: live.activeTimeOutsideShiftMs,
      offlineTimeOutsideShiftMs: live.offlineTimeOutsideShiftMs,
      totalBreakTimeMs: live.totalBreakTimeMs,
      totalIdleTimeMs: live.totalIdleTimeMs,
      totalOfflineTimeMs: live.totalOfflineTimeMs,

      totalActiveTimeDuringWorkingHours: formatDuration(live.activeTimeInsideShiftMs),
      totalIdleTimeDuringWorkingHours: formatDuration(live.idleTimeInsideShiftMs),
      totalOfflineTimeDuringWorkingHours: formatDuration(live.offlineTimeInsideShiftMs),
      totalBreakTime: formatDuration(live.totalBreakTimeMs),
      totalOfflineTime: formatDuration(live.totalOfflineTimeMs),
      outOfShiftActivityTime: formatDuration(live.activeTimeOutsideShiftMs),
      offlineOutOfShiftTime: formatDuration(live.offlineTimeOutsideShiftMs),

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
    .populate('assignedTeamLeader', 'name email employeeId')
    .populate('createdBy', 'name email employeeId role')
    .populate('verifiedBy', 'name email employeeId')
    .populate('documents.uploadedBy', 'name email employeeId')
    .populate('documents.reviewedBy', 'name email employeeId');

  if (!user) throw new ApiError(404, 'User not found');

  res.json({ success: true, user });
});

const updateUser = asyncHandler(async (req, res) => {
  if (!(await canAccessUser(req.user, req.params.id))) {
    throw new ApiError(403, 'Access denied');
  }

  const protectedFields = ['password', 'role', 'employeeId', 'createdBy', 'tokenVersion'];
  protectedFields.forEach(field => delete req.body[field]);

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');

  Object.assign(user, req.body);
  user.calculateProfileCompletion();

  if (String(req.user._id) === String(user._id)) {
    markProfilePendingReview(user);
  } else if (user.profileCompletionPercentage < 100) {
    user.isVerified = false;
    user.verificationStatus = 'document_pending';
  }

  await user.save();

  if (String(req.user._id) === String(user._id)) {
    await sendProfileReviewNotification({ req, employee: user, reason: 'updated profile details' });
  }

  res.json({ success: true, user });
});

const deleteUser = asyncHandler(async (req, res) => {
  if (![ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR].includes(req.user.role)) {
    throw new ApiError(403, 'Access denied');
  }

  if (String(req.user._id) === String(req.params.id)) {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }

  if (!(await canAccessUser(req.user, req.params.id))) {
    throw new ApiError(403, 'Access denied');
  }

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');

  user.isActive = false;
  user.onlineStatus = 'offline';
  user.currentActivityState = ACTIVITY_STATES.OFFLINE;
  user.lastSeen = new Date();
  user.tokenVersion += 1;

  await user.save();
  await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });

  req.app.get('io')?.emit('employee_status_changed', {
    userId: user._id,
    isActive: user.isActive,
    currentActivityState: user.currentActivityState,
    onlineStatus: user.onlineStatus
  });

  res.json({ success: true, message: 'Employee deactivated', user });
});

const setUserActiveStatus = asyncHandler(async (req, res) => {
  if (![ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR].includes(req.user.role)) {
    throw new ApiError(403, 'Access denied');
  }

  if (!(await canAccessUser(req.user, req.params.id))) {
    throw new ApiError(403, 'Access denied');
  }

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');

  const isActive =
    req.body.isActive === true ||
    req.body.isActive === 'true' ||
    req.body.status === 'active';

  if (!isActive && String(req.user._id) === String(user._id)) {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }

  user.isActive = isActive;

  if (!isActive) {
    user.onlineStatus = 'offline';
    user.currentActivityState = ACTIVITY_STATES.OFFLINE;
    user.lastSeen = new Date();
    user.tokenVersion += 1;

    await RefreshToken.updateMany(
      { user: user._id, revokedAt: null },
      { revokedAt: new Date() }
    );
  }

  await user.save();

  req.app.get('io')?.emit('employee_status_changed', {
    userId: user._id,
    isActive: user.isActive,
    currentActivityState: user.currentActivityState,
    onlineStatus: user.onlineStatus
  });

  res.json({
    success: true,
    message: isActive ? 'Employee activated' : 'Employee deactivated',
    user
  });
});

const verifyUser = asyncHandler(async (req, res) => {
  if (![ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR].includes(req.user.role)) {
    throw new ApiError(403, 'Only Super Admin/Admin/HR can verify profiles');
  }

  if (!(await canAccessUser(req.user, req.params.id))) {
    throw new ApiError(403, 'Access denied');
  }

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');

  const status = req.body.status || (req.body.isVerified === false ? 'not_verified' : 'verified');

  if (!REVIEW_STATUSES.includes(status)) {
    throw new ApiError(400, `Status must be one of: ${REVIEW_STATUSES.join(', ')}`);
  }

  user.calculateProfileCompletion();

  if (status === 'verified' && user.profileCompletionPercentage < 100) {
    throw new ApiError(400, `Profile incomplete: ${user.pendingRequiredFields.join(', ')}`);
  }

  user.isVerified = status === 'verified';
  user.verificationStatus = status;
  user.verificationNotes = req.body.notes || req.body.verificationNotes || '';
  user.verifiedBy = req.user._id;
  user.verifiedAt = new Date();

  user.documents.forEach(document => {
    if (document.status === 'pending_review') {
      document.status = status === 'verified' ? 'verified' : status;
      document.reviewedBy = req.user._id;
      document.reviewedAt = new Date();
      document.reviewNote = user.verificationNotes;
    }
  });

  await user.save();

  await notifyUser({
    user: user._id,
    title: 'Profile verification updated',
    message: `Your profile status is now ${status.replace(/_/g, ' ')}.${user.verificationNotes ? ` Note: ${user.verificationNotes}` : ''}`,
    type: 'profile_verification_updated',
    metadata: { userId: user._id, status }
  });

  req.app.get('io')?.emit('profile_verification_updated', {
    userId: user._id,
    verificationStatus: user.verificationStatus,
    isVerified: user.isVerified
  });

  res.json({ success: true, user });
});

const completeProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(404, 'User not found');

  const allowedGenderValues = ['Male', 'Female', 'Other', 'Prefer not to say'];

  const normalizedBody = Object.fromEntries(
    Object.entries(req.body || {})
      .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
      .filter(([key, value]) =>
        !['documents', 'documentNames'].includes(key) &&
        value !== undefined &&
        value !== null &&
        value !== ''
      )
  );

  if (normalizedBody.gender && !allowedGenderValues.includes(normalizedBody.gender)) {
    throw new ApiError(400, `Gender must be one of: ${allowedGenderValues.join(', ')}`);
  }

  Object.assign(user, normalizedBody);
  await appendUploadedProfileFiles({ user, files: req.files || [], body: req.body, actorId: req.user._id });

  user.calculateProfileCompletion();
  markProfilePendingReview(user);

  await user.save();
  await sendProfileReviewNotification({ req, employee: user, reason: 'submitted profile details/documents for verification' });

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
    .populate('quotations', 'quotationNo totalAmount status createdAt')
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
  setUserActiveStatus,
  verifyUser,
  completeProfile,
  userActivity
};
