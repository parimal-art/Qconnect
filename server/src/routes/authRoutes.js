const router = require('express').Router();
const auth = require('../controllers/authController');
const { authenticateUser } = require('../middleware/auth');

router.post('/login', auth.login);
router.post('/logout', authenticateUser, auth.logout);
router.post('/refresh-token', auth.refreshToken);
router.post('/change-password', authenticateUser, auth.changePassword);
router.post('/forgot-password', auth.forgotPassword);
router.post('/reset-password', auth.resetPassword);
router.get('/me', authenticateUser, auth.me);

module.exports = router;
