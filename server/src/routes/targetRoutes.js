const router = require('express').Router();
const targets = require('../controllers/targetController');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);
router.get('/my-summary', targets.mySummary);
router.get('/team', targets.listTeamTargets);
router.get('/user/:id/summary', targets.userSummary);
router.post('/', targets.assignTarget);
router.put('/:id', targets.updateTarget);

module.exports = router;
