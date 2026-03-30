const express = require('express');
const router = express.Router();
const gameController = require('../controllers/game.controller');
const { authenticateToken, checkBan } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

router.get('/categories', gameController.getCategories);
router.get('/leaderboard', gameController.getLeaderboard);

router.use(authenticateToken, checkBan);
router.use(apiLimiter);

router.post('/:roomId/start', gameController.start);
router.post('/:roomId/answers', gameController.submitAnswers);
router.post('/:roomId/vote', gameController.vote);
router.delete('/:roomId/vote', gameController.removeVote);
router.post('/:roomId/images', gameController.uploadImage);
router.get('/recovery/:code', gameController.getRecoveryState);
router.get('/images/:imageId', gameController.getImage);
router.get('/rounds/:roundId/results', gameController.getRoundResults);

module.exports = router;
