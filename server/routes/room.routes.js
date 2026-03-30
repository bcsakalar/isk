const express = require('express');
const router = express.Router();
const roomController = require('../controllers/room.controller');
const { authenticateToken, checkBan } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// Public endpoints (no auth required)
router.get('/preview/:code', roomController.getPreview);
router.get('/public', apiLimiter, roomController.listPublic);

router.use(authenticateToken, checkBan);
router.use(apiLimiter);

router.get('/', roomController.list);
router.post('/', roomController.create);
router.post('/join', roomController.join);
router.get('/code/:code', roomController.getByCode);
router.get('/:roomId', roomController.get);
router.post('/:roomId/leave', roomController.leave);
router.post('/:roomId/ready', roomController.setReady);
router.put('/:roomId/settings', roomController.updateSettings);
router.put('/:roomId/categories', roomController.updateCategories);
router.post('/:roomId/categories', roomController.addCategory);
router.delete('/:roomId/categories/:categoryId', roomController.removeCategory);
router.put('/:roomId/letters', roomController.updateLetters);

module.exports = router;
