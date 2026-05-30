require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Attendance = require('../models/Attendance');
const Break = require('../models/Break');
const Leave = require('../models/Leave');
const Notification = require('../models/Notification');
const RefreshToken = require('../models/RefreshToken');
const { ROLES } = require('../constants/roles');
const { createLead } = require('../services/leadService');

const seed = async () => {
  await connectDB();
  await Promise.all([
    User.deleteMany({}),
    Lead.deleteMany({}),
    Attendance.deleteMany({}),
    Break.deleteMany({}),
    Leave.deleteMany({}),
    Notification.deleteMany({}),
    RefreshToken.deleteMany({})
  ]);

  const superAdmin = await User.create({
    name: 'Super Admin User',
    email: 'superadmin@example.com',
    password: 'Super@123',
    role: ROLES.SUPER_ADMIN,
    employeeId: 'SA-00001',
    phone: '9000000000',
    address: 'Head Office',
    profilePhoto: '/uploads/default-admin.png',
    aadhaarCard: '/uploads/default-aadhaar.pdf',
    emergencyContactNumber: '9000000099',
    dateOfBirth: new Date('1988-01-01'),
    gender: 'Other',
    joiningDate: new Date(),
    firstLogin: false,
    passwordChanged: true,
    isVerified: true,
    verificationStatus: 'verified'
  });

  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'Admin@123',
    role: ROLES.ADMIN,
    employeeId: 'ADM-00001',
    createdBy: superAdmin._id,
    phone: '9000000001',
    address: 'Corporate Office',
    profilePhoto: '/uploads/default-admin.png',
    aadhaarCard: '/uploads/default-aadhaar.pdf',
    emergencyContactNumber: '9000000099',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'Other',
    joiningDate: new Date(),
    firstLogin: false,
    passwordChanged: true,
    isVerified: true,
    verificationStatus: 'verified'
  });

  const hr = await User.create({
    name: 'HR User',
    email: 'hr@example.com',
    password: 'Hr@123',
    role: ROLES.HR,
    employeeId: 'HR-00001',
    hrUniqueId: 'HR-00001',
    createdBy: admin._id,
    phone: '9000000002',
    address: 'HR Desk',
    profilePhoto: '/uploads/default-hr.png',
    aadhaarCard: '/uploads/default-aadhaar.pdf',
    emergencyContactNumber: '9000000099',
    dateOfBirth: new Date('1992-02-02'),
    gender: 'Female',
    joiningDate: new Date(),
    firstLogin: false,
    passwordChanged: true,
    isVerified: true,
    verificationStatus: 'verified'
  });

  const tl = await User.create({
    name: 'Team Leader User',
    email: 'tl@example.com',
    password: 'Tl@123',
    role: ROLES.TEAM_LEADER,
    employeeId: 'TL-00001',
    teamLeaderUniqueId: 'TL-00001',
    assignedHR: hr._id,
    createdBy: admin._id,
    phone: '9000000003',
    address: 'Sales Floor',
    profilePhoto: '/uploads/default-tl.png',
    aadhaarCard: '/uploads/default-aadhaar.pdf',
    emergencyContactNumber: '9000000099',
    dateOfBirth: new Date('1993-03-03'),
    gender: 'Male',
    joiningDate: new Date(),
    firstLogin: false,
    passwordChanged: true,
    isVerified: true,
    verificationStatus: 'verified'
  });

  const sales = await User.create({
    name: 'Salesperson User',
    email: 'salesperson@example.com',
    password: 'Sales@123',
    role: ROLES.SALESPERSON,
    employeeId: 'EMP-00001',
    assignedHR: hr._id,
    assignedTeamLeader: tl._id,
    createdBy: tl._id,
    phone: '9000000004',
    address: 'Remote',
    profilePhoto: '/uploads/default-sales.png',
    aadhaarCard: '/uploads/default-aadhaar.pdf',
    emergencyContactNumber: '9000000099',
    dateOfBirth: new Date('1995-04-04'),
    gender: 'Male',
    joiningDate: new Date(),
    firstLogin: false,
    passwordChanged: true,
    isVerified: true,
    verificationStatus: 'verified'
  });

  for (const u of [superAdmin, admin, hr, tl, sales]) {
    u.calculateProfileCompletion();
    await u.save();
  }

  await createLead({ actor: tl, data: { name: 'Rahul Das', companyName: 'Acme Software', contactNumber: '9876543210', email: 'rahul@acme.com', website: 'acme.com', domain: 'SaaS', source: 'Seed', leadType: 'Hot Lead', assignedTo: sales._id, pipelineStatus: 'Interested', callStatus: 'Received', actionRequired: 'Follow-up', followUpDate: new Date(Date.now() + 86400000) } });
  await createLead({ actor: sales, data: { name: 'Priya Sen', companyName: 'Zen Retail', contactNumber: '9876500000', email: 'priya@zenretail.com', website: 'zenretail.com', domain: 'Retail', source: 'Self', leadType: 'Mid Lead', pipelineStatus: 'New Lead' } });

  console.log('Seed completed');
  console.table([
    { role: 'Super Admin', email: 'superadmin@example.com', password: 'Super@123' },
    { role: 'Admin', email: 'admin@example.com', password: 'Admin@123' },
    { role: 'HR', email: 'hr@example.com', password: 'Hr@123' },
    { role: 'Team Leader', email: 'tl@example.com', password: 'Tl@123' },
    { role: 'Salesperson', email: 'salesperson@example.com', password: 'Sales@123' }
  ]);
  await mongoose.disconnect();
};

seed().catch(async error => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
