const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');
const { createAccessToken, createRefreshToken, hashToken } = require('../utils/jwt');
const { randomToken, hashResetToken } = require('../utils/password');
const { sendEmail } = require('../utils/email');
const { processHeartbeat, markOffline } = require('../services/trackingService');
const { ACTIVITY_STATES } = require('../constants/roles');

const cookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000
};

const persistRefreshToken = async (user, token, req) => RefreshToken.create({
  user: user._id,
  tokenHash: hashToken(token),
  userAgent: req.headers['user-agent'],
  ipAddress: req.ip,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
});

const serializeUser = user => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  employeeId: user.employeeId,
  hrUniqueId: user.hrUniqueId,
  teamLeaderUniqueId: user.teamLeaderUniqueId,
  assignedHR: user.assignedHR,
  assignedTeamLeader: user.assignedTeamLeader,
  firstLogin: user.firstLogin,
  passwordChanged: user.passwordChanged,
  profileCompletionPercentage: user.profileCompletionPercentage,
  pendingRequiredFields: user.pendingRequiredFields,
  phone: user.phone,
  address: user.address,
  emergencyContactNumber: user.emergencyContactNumber,
  dateOfBirth: user.dateOfBirth,
  gender: user.gender,
  joiningDate: user.joiningDate,
  previousCompanyName: user.previousCompanyName,
  panCard: user.panCard,
  profilePhoto: user.profilePhoto,
  aadhaarCard: user.aadhaarCard,
  documents: user.documents,
  verificationStatus: user.verificationStatus,
  verificationNotes: user.verificationNotes,
  lastProfileSubmittedAt: user.lastProfileSubmittedAt,
  isVerified: user.isVerified,
  shiftStart: user.shiftStart,
  shiftEnd: user.shiftEnd
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required');
  const user = await User.findOne({ email: email.toLowerCase(), isActive: true }).select('+password');
  if (!user || !(await user.comparePassword(password))) throw new ApiError(401, 'Invalid credentials');
  user.calculateProfileCompletion();
  await user.save();
  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);
  await persistRefreshToken(user, refreshToken, req);
  res.cookie(env.refreshCookieName, refreshToken, cookieOptions);
  await processHeartbeat({ user, state: ACTIVITY_STATES.ACTIVE, req, metadata: { event: 'login' } });
  res.json({ success: true, accessToken, user: serializeUser(user) });
});

const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[env.refreshCookieName] || req.body.refreshToken;
  if (token) await RefreshToken.findOneAndUpdate({ tokenHash: hashToken(token) }, { revokedAt: new Date() });
  if (req.user) await markOffline(req.user, req);
  res.clearCookie(env.refreshCookieName, cookieOptions);
  res.json({ success: true, message: 'Logged out' });
});

const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.[env.refreshCookieName] || req.body.refreshToken;
  if (!token) throw new ApiError(401, 'Refresh token missing');
  let payload;
  try {
    payload = jwt.verify(token, env.jwtRefreshSecret);
  } catch {
    throw new ApiError(401, 'Invalid refresh token');
  }
  const stored = await RefreshToken.findOne({ tokenHash: hashToken(token), revokedAt: null });
  if (!stored || stored.expiresAt < new Date()) throw new ApiError(401, 'Refresh session expired');
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive || user.tokenVersion !== payload.tokenVersion) throw new ApiError(401, 'Invalid refresh session');
  const accessToken = createAccessToken(user);
  res.json({ success: true, accessToken, user: serializeUser(user) });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) throw new ApiError(400, 'New password must be at least 8 characters');
  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw new ApiError(404, 'User not found');
  if (!user.firstLogin && !(await user.comparePassword(currentPassword || ''))) throw new ApiError(401, 'Current password is incorrect');
  user.password = newPassword;
  user.firstLogin = false;
  user.passwordChanged = true;
  user.tokenVersion += 1;
  await user.save();
  await RefreshToken.updateMany({ user: user._id }, { revokedAt: new Date() });
  res.clearCookie(env.refreshCookieName, cookieOptions);
  res.json({ success: true, message: 'Password changed. Please login again.' });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: String(email || '').toLowerCase(), isActive: true }).select('+passwordResetToken +passwordResetExpires');
  if (user) {
    const token = randomToken();
    user.passwordResetToken = hashResetToken(token);
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    const resetUrl = `${env.clientUrl}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
    await sendEmail({ to: user.email, subject: 'Reset your CRM password', text: `Reset password: ${resetUrl}`, html: `<p>Reset your password using this link:</p><p><a href="${resetUrl}">${resetUrl}</a></p>` });
  }
  res.json({ success: true, message: 'If the email exists, reset instructions were sent.' });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { email, token, newPassword } = req.body;
  if (!email || !token || !newPassword) throw new ApiError(400, 'Email, token and new password are required');
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordResetToken +passwordResetExpires');
  if (!user || user.passwordResetToken !== hashResetToken(token) || user.passwordResetExpires < new Date()) throw new ApiError(400, 'Invalid or expired reset token');
  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.firstLogin = false;
  user.passwordChanged = true;
  user.tokenVersion += 1;
  await user.save();
  await RefreshToken.updateMany({ user: user._id }, { revokedAt: new Date() });
  res.json({ success: true, message: 'Password reset successful' });
});

const me = asyncHandler(async (req, res) => res.json({ success: true, user: serializeUser(req.user) }));

module.exports = { login, logout, refreshToken, changePassword, forgotPassword, resetPassword, me };
