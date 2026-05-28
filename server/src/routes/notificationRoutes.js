const router = require('express').Router();
const notifications = require('../controllers/notificationController');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);
router.get('/', notifications.list);
router.put('/read-all', notifications.readAll);
router.put('/:id/read', notifications.markRead);

module.exports = router;
