const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const authenticateUser = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Authentication token missing');
  try {
    const payload = jwt.verify(token, env.jwtAccessSecret);
    const user = await User.findById(payload.sub).select('-password');
    if (!user || !user.isActive) throw new ApiError(401, 'User not found or inactive');
    req.user = user;
    next();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(401, 'Invalid or expired token');
  }
});

module.exports = { authenticateUser };
