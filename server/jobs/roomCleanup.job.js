const cron = require('node-cron');
const cleanupService = require('../services/cleanup.service');
const logger = require('../utils/logger');

// Her 5 dakikada: 30 dk'dan fazla inaktif odaları temizle
const roomCleanupJob = cron.schedule('*/5 * * * *', async () => {
  try {
    const count = await cleanupService.cleanInactiveRooms(30);
    if (count > 0) {
      logger.info('Room cleanup completed', { cleanedRooms: count });
    }
  } catch (err) {
    logger.error('Room cleanup job failed', { error: err.message });
  }
}, { scheduled: false });

module.exports = roomCleanupJob;
