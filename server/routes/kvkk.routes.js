const express = require('express');
const router = express.Router();
const kvkkController = require('../controllers/kvkk.controller');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

router.use(apiLimiter);

router.post('/accept-privacy', authenticateToken, kvkkController.acceptPrivacy);
router.get('/privacy-status', authenticateToken, kvkkController.getPrivacyStatus);
router.post('/request-deletion', authenticateToken, kvkkController.requestDeletion);
router.post('/cancel-deletion', authenticateToken, kvkkController.cancelDeletion);
router.get('/export', authenticateToken, kvkkController.exportData);

module.exports = router;
