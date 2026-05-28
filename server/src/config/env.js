require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crm_employee_tracker',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me',
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  refreshCookieName: process.env.REFRESH_COOKIE_NAME || 'crm_refresh_token',
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 12),
  heartbeatIntervalSeconds: Number(process.env.HEARTBEAT_INTERVAL_SECONDS || 30),
  idleAfterSeconds: Number(process.env.IDLE_AFTER_SECONDS || 300),
  offlineAfterSeconds: Number(process.env.OFFLINE_AFTER_SECONDS || 120),
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || 'CRM Tracker <no-reply@example.com>'
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET
  }
};

module.exports = env;
