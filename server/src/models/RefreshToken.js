const mongoose = require('mongoose');

const RefreshTokenSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  userAgent: String,
  ipAddress: String,
  expiresAt: { type: Date, required: true, index: true },
  revokedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('RefreshToken', RefreshTokenSchema);
