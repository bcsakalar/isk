const cron = require('node-cron');
const cleanupService = require('../services/cleanup.service');
const logger = require('../utils/logger');

// Her saat başı: süresi dolmuş sessionları temizle
const sessionCleanupJob = cron.schedule('0 * * * *', async () => {
  try {
    const count = await cleanupService.cleanExpiredSessions();
    if (count > 0) {
      logger.info('Session cleanup completed', { cleanedSessions: count });
    }
  } catch (err) {
    logger.error('Session cleanup job failed', { error: err.message });
  }
}, { scheduled: false });

module.exports = sessionCleanupJob;
