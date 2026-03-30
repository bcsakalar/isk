const gameController = require('../controllers/game.controller');

const leaderboardController = {
  getLeaderboard: gameController.getLeaderboard,
};

module.exports = leaderboardController;
