const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticateToken, checkBan } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

router.get('/:userId/profile', apiLimiter, userController.getProfile);

router.use(authenticateToken, checkBan);
router.get('/me', userController.getMe);
router.put('/me', userController.updateProfile);
router.get('/me/achievements', userController.getMyAchievements);
router.put('/profile', userController.updateProfile);
router.get('/achievements', userController.getMyAchievements);

module.exports = router;
