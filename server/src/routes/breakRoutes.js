const router = require('express').Router();
const breaks = require('../controllers/breakController');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);
router.post('/start', breaks.start);
router.post('/end', breaks.end);
router.get('/report', breaks.report);

module.exports = router;
