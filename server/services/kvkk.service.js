const kvkkQueries = require('../db/queries/kvkk.queries');
const { BadRequestError, NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

const CURRENT_PRIVACY_VERSION = '1.0';

const kvkkService = {
  async acceptPrivacy({ userId, ip, userAgent }) {
    await kvkkQueries.recordConsent({
      userId,
      consentType: 'privacy_policy',
      consentVersion: CURRENT_PRIVACY_VERSION,
      ipAddress: ip,
      userAgent,
    });
    await kvkkQueries.updateUserPrivacyAcceptance(userId, CURRENT_PRIVACY_VERSION);
    logger.info('Privacy accepted', { userId, version: CURRENT_PRIVACY_VERSION });
    return { version: CURRENT_PRIVACY_VERSION };
  },

  async getPrivacyStatus(userId) {
    const status = await kvkkQueries.getUserPrivacyStatus(userId);
    if (!status) throw new NotFoundError('Kullanıcı bulunamadı');
    const consents = await kvkkQueries.getConsentHistory(userId);
    return {
      accepted: !!status.privacy_accepted_at,
      version: status.privacy_version,
      acceptedAt: status.privacy_accepted_at,
      deletionRequested: !!status.deletion_requested_at,
      consents,
    };
  },

  async requestDeletion({ userId, reason, ip }) {
    const existing = await kvkkQueries.getDeletionRequest(userId);
    if (existing) {
      throw new BadRequestError('Zaten aktif bir silme talebiniz bulunuyor');
    }
    const request = await kvkkQueries.requestDeletion({
      userId,
      reason: reason || null,
      ipAddress: ip,
    });
    logger.info('Account deletion requested', { userId, scheduledFor: request.scheduled_for });
    return request;
  },

  async cancelDeletion(userId) {
    const existing = await kvkkQueries.getDeletionRequest(userId);
    if (!existing) {
      throw new BadRequestError('Aktif bir silme talebi bulunamadı');
    }
    await kvkkQueries.cancelDeletion(userId);
    logger.info('Account deletion cancelled', { userId });
  },

  async exportData(userId) {
    const data = await kvkkQueries.exportUserData(userId);
    if (!data.user) throw new NotFoundError('Kullanıcı bulunamadı');
    logger.info('User data exported (KVKK)', { userId });
    return data;
  },

  async processScheduledDeletions() {
    const scheduled = await kvkkQueries.getScheduledDeletions();
    let processed = 0;
    for (const item of scheduled) {
      try {
        await kvkkQueries.deleteUserPermanently(item.user_id);
        await kvkkQueries.markDeletionCompleted(item.id);
        processed++;
        logger.info('Account permanently deleted', { userId: item.user_id, username: item.username });
      } catch (err) {
        logger.error('Failed to delete account', { userId: item.user_id, error: err.message });
      }
    }
    return processed;
  },
};

module.exports = kvkkService;
