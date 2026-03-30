const cron = require('node-cron');
const cleanupService = require('../services/cleanup.service');
const logger = require('../utils/logger');

// Her gece 03:00'te: 7 günden eski chatları temizle
const chatPurgeJob = cron.schedule('0 3 * * *', async () => {
  try {
    const count = await cleanupService.purgeOldChats(7);
    if (count > 0) {
      logger.info('Chat purge completed', { purgedMessages: count });
    }
  } catch (err) {
    logger.error('Chat purge job failed', { error: err.message });
  }
}, { scheduled: false });

module.exports = chatPurgeJob;
