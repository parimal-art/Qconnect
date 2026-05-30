const router = require('express').Router();
const leads = require('../controllers/leadController');
const { authenticateUser } = require('../middleware/auth');
const { ensureCanDeleteLead } = require('../middleware/rbac');
const upload = require('../middleware/upload');

router.use(authenticateUser);
router.post('/', leads.create);
router.post('/upload', upload.single('file'), leads.upload);
router.get('/', leads.list);
router.get('/search', leads.search);
router.post('/check-duplicate', leads.checkDuplicate);
router.get('/:id', leads.getById);
router.put('/:id', leads.update);
router.put('/:id/status', leads.updateStatus);
router.put('/:id/complete', leads.complete);
router.put('/:id/finalize-deal', leads.finalizeDeal);
router.delete('/:id', ensureCanDeleteLead, leads.remove);
router.post('/:id/timeline', leads.addTimeline);

module.exports = router;
