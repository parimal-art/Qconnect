const router = require('express').Router();
const reports = require('../controllers/reportController');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);
router.get('/dashboard', reports.dashboard);
router.get('/leads', reports.leads);
router.get('/attendance', reports.attendance);
router.get('/active-hours', reports.activeHours);
router.get('/team-performance', reports.teamPerformance);
router.get('/salesperson-performance', reports.salespersonPerformance);
router.get('/export/csv', reports.exportReport);
router.get('/export/excel', reports.exportReport);
router.get('/export/pdf', reports.exportReport);

module.exports = router;
