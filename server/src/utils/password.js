const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const env = require('../config/env');

const hashPassword = password => bcrypt.hash(password, env.bcryptSaltRounds);
const comparePassword = (password, hash) => bcrypt.compare(password, hash);
const randomToken = () => crypto.randomBytes(32).toString('hex');
const hashResetToken = token => crypto.createHash('sha256').update(token).digest('hex');

module.exports = { hashPassword, comparePassword, randomToken, hashResetToken };
