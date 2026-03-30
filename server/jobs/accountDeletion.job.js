const cron = require('node-cron');
const kvkkService = require('../services/kvkk.service');
const logger = require('../utils/logger');

// Her gün 03:30'da: zamanı gelmiş hesap silme taleplerini işle
const accountDeletionJob = cron.schedule('30 3 * * *', async () => {
  try {
    const count = await kvkkService.processScheduledDeletions();
    if (count > 0) {
      logger.info('Account deletion job completed', { deletedAccounts: count });
    }
  } catch (err) {
    logger.error('Account deletion job failed', { error: err.message });
  }
}, { scheduled: false });

module.exports = accountDeletionJob;
