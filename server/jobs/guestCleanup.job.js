const cron = require('node-cron');
const usersQueries = require('../db/queries/users.queries');
const logger = require('../utils/logger');

// Her saat başı: süresi dolmuş misafir hesapları temizle
const guestCleanupJob = cron.schedule('30 * * * *', async () => {
  try {
    const count = await usersQueries.deleteExpiredGuests();
    if (count > 0) {
      logger.info('Guest cleanup completed', { cleanedGuests: count });
    }
  } catch (err) {
    logger.error('Guest cleanup job failed', { error: err.message });
  }
}, { scheduled: false });

module.exports = guestCleanupJob;
