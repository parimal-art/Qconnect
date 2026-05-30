const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const trackingRoutes = require('./routes/trackingRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leadRoutes = require('./routes/leadRoutes');
const breakRoutes = require('./routes/breakRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const reportRoutes = require('./routes/reportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const targetRoutes = require('./routes/targetRoutes');
const quotationRoutes = require('./routes/quotationRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 500 }));
app.use('/uploads', express.static(path.resolve(process.cwd(), env.uploadDir)));

app.get('/health', (req, res) => res.json({ success: true, service: 'crm-employee-tracker-api', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/break', breakRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/targets', targetRoutes);
app.use('/api/quotations', quotationRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
