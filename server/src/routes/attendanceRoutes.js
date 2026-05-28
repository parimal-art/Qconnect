const router = require('express').Router();
const attendance = require('../controllers/attendanceController');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);
router.post('/login', attendance.loginAttendance);
router.post('/logout', attendance.logoutAttendance);
router.get('/user/:id', attendance.getUserAttendance);
router.get('/report', attendance.attendanceReport);
router.get('/active-users', attendance.activeUsers);

module.exports = router;
