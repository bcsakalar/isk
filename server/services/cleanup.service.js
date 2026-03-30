const roomsQueries = require('../db/queries/rooms.queries');
const gamesQueries = require('../db/queries/games.queries');
const adminQueries = require('../db/queries/admin.queries');
const env = require('../config/env');
const logger = require('../utils/logger');

const cleanupService = {
  async cleanInactiveRooms() {
    const inactiveIds = await roomsQueries.getInactiveRooms(env.cleanup.roomInactiveMinutes);
    if (inactiveIds.length > 0) {
      await roomsQueries.abandonRooms(inactiveIds);
      logger.info(`Abandoned ${inactiveIds.length} inactive rooms`);
    }

    // 24 saatten eski bitmiş/terk edilmiş odaları sil
    await roomsQueries.deleteOldAbandoned(1);
  },

  async cleanExpiredSessions() {
    const count = await adminQueries.cleanExpiredSessions();
    if (count > 0) {
      logger.info(`Cleaned ${count} expired sessions`);
    }
  },

  async purgeOldChats() {
    const count = await gamesQueries.purgeOldMessages(env.cleanup.chatRetentionDays);
    if (count > 0) {
      logger.info(`Purged ${count} old chat messages`);
    }
  },
};

module.exports = cleanupService;
