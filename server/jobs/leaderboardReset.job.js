const cron = require('node-cron');
const gamesQueries = require('../db/queries/games.queries');
const logger = require('../utils/logger');

// Haftalık: Pazar gece 00:00 — liderlik tablosu snapshot
const leaderboardResetJob = cron.schedule('0 0 * * 0', async () => {
  try {
    // Mevcut leaderboard snapshot'ı al
    const usersQueries = require('../db/queries/users.queries');
    const top100 = await usersQueries.getLeaderboard('xp', 100);

    for (const user of top100) {
      await gamesQueries.upsertLeaderboard({
        userId: user.id,
        period: 'weekly',
        score: user.total_xp,
        rank: top100.indexOf(user) + 1,
      });
    }

    logger.info('Leaderboard weekly snapshot completed', { entries: top100.length });
  } catch (err) {
    logger.error('Leaderboard reset job failed', { error: err.message });
  }
}, { scheduled: false });

module.exports = leaderboardResetJob;
