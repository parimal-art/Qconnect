const router = require('express').Router();
const leave = require('../controllers/leaveController');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);
router.post('/request', leave.requestLeave);
router.get('/', leave.list);
router.put('/:id/approve', leave.approve);
router.put('/:id/reject', leave.reject);

module.exports = router;
