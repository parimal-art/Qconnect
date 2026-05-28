const router = require('express').Router();
const tracking = require('../controllers/trackingController');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);
router.post('/heartbeat', tracking.heartbeat);
router.post('/idle', tracking.markIdle);
router.post('/active', tracking.markActive);
router.post('/offline', tracking.offline);
router.get('/children', tracking.children);
router.get('/children/:userId', tracking.childByUser);
router.get('/summary', tracking.summary);
router.get('/working-hours-report', tracking.workingHoursReport);

module.exports = router;
