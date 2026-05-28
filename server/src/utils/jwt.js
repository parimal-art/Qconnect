const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

const createAccessToken = user => jwt.sign(
  { sub: user._id.toString(), role: user.role, employeeId: user.employeeId },
  env.jwtAccessSecret,
  { expiresIn: env.accessTokenExpiresIn }
);

const createRefreshToken = user => jwt.sign(
  { sub: user._id.toString(), tokenVersion: user.tokenVersion || 0 },
  env.jwtRefreshSecret,
  { expiresIn: env.refreshTokenExpiresIn }
);

const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

module.exports = { createAccessToken, createRefreshToken, hashToken };
