const router = require('express').Router();
const user = require('../controllers/userController');
const { authenticateUser } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');
const upload = require('../middleware/upload');
const { ROLES } = require('../constants/roles');

router.use(authenticateUser);
router.post('/create', authorizeRoles(ROLES.ADMIN, ROLES.HR), user.createUser);
router.get('/', user.getUsers);
router.get('/children', user.getChildren);
router.get('/children/tracking', user.trackingForChildren);
router.put('/profile/complete', upload.any(), user.completeProfile);
router.get('/:id', user.getUserById);
router.put('/:id', user.updateUser);
router.patch('/:id/status', authorizeRoles(ROLES.ADMIN, ROLES.HR), user.setUserActiveStatus);
router.delete('/:id', authorizeRoles(ROLES.ADMIN, ROLES.HR), user.deleteUser);
router.put('/:id/verify', authorizeRoles(ROLES.ADMIN, ROLES.HR), user.verifyUser);
router.get('/:id/activity', user.userActivity);

module.exports = router;