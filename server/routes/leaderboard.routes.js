const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboard.controller');
const { apiLimiter } = require('../middleware/rateLimiter');

router.get('/', apiLimiter, leaderboardController.getLeaderboard);

module.exports = router;
