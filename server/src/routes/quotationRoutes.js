const router = require('express').Router();
const quotations = require('../controllers/quotationController');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);
router.get('/', quotations.list);
router.post('/', quotations.create);
router.get('/:id', quotations.getById);
router.put('/:id', quotations.update);
router.get('/:id/download', quotations.download);

module.exports = router;
