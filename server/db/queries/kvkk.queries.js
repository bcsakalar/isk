const { query } = require('../../config/database');

const kvkkQueries = {
  // ─── Gizlilik Onayı ────────────────────────────────────────
  async recordConsent({ userId, consentType, consentVersion, ipAddress, userAgent }) {
    const result = await query(
      `INSERT INTO privacy_consents (user_id, consent_type, consent_version, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [userId, consentType, consentVersion, ipAddress, userAgent]
    );
    return result.rows[0];
  },

  async updateUserPrivacyAcceptance(userId, version) {
    await query(
      `UPDATE users SET privacy_accepted_at = now(), privacy_version = $2 WHERE id = $1`,
      [userId, version]
    );
  },

  async getConsentHistory(userId) {
    const result = await query(
      `SELECT consent_type, consent_version, accepted, created_at
       FROM privacy_consents WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  },

  async getUserPrivacyStatus(userId) {
    const result = await query(
      `SELECT privacy_accepted_at, privacy_version, deletion_requested_at FROM users WHERE id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  },

  // ─── Hesap Silme Talebi ────────────────────────────────────
  async requestDeletion({ userId, reason, ipAddress }) {
    const scheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 gün
    const result = await query(
      `INSERT INTO user_deletions (user_id, scheduled_for, reason, ip_address)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         requested_at = now(),
         scheduled_for = $2,
         reason = $3,
         ip_address = $4,
         completed_at = NULL
       RETURNING id, requested_at, scheduled_for`,
      [userId, scheduledFor, reason, ipAddress]
    );
    await query(
      `UPDATE users SET deletion_requested_at = now() WHERE id = $1`,
      [userId]
    );
    return result.rows[0];
  },

  async cancelDeletion(userId) {
    await query(
      `DELETE FROM user_deletions WHERE user_id = $1 AND completed_at IS NULL`,
      [userId]
    );
    await query(
      `UPDATE users SET deletion_requested_at = NULL WHERE id = $1`,
      [userId]
    );
  },

  async getDeletionRequest(userId) {
    const result = await query(
      `SELECT id, requested_at, scheduled_for, reason
       FROM user_deletions WHERE user_id = $1 AND completed_at IS NULL`,
      [userId]
    );
    return result.rows[0] || null;
  },

  async getScheduledDeletions() {
    const result = await query(
      `SELECT ud.id, ud.user_id, ud.scheduled_for, u.username
       FROM user_deletions ud
       JOIN users u ON u.id = ud.user_id
       WHERE ud.completed_at IS NULL AND ud.scheduled_for <= now()`
    );
    return result.rows;
  },

  async markDeletionCompleted(id) {
    await query(
      `UPDATE user_deletions SET completed_at = now() WHERE id = $1`,
      [id]
    );
  },

  // ─── Veri Dışa Aktarma (KVKK Madde 11) ────────────────────
  async exportUserData(userId) {
    const user = await query(
      `SELECT id, username, display_name, email, avatar_url, role, xp, level,
              total_wins, total_games, is_guest, created_at, last_login_at,
              privacy_accepted_at, privacy_version
       FROM users WHERE id = $1`,
      [userId]
    );
    const consents = await query(
      `SELECT consent_type, consent_version, accepted, created_at
       FROM privacy_consents WHERE user_id = $1 ORDER BY created_at`,
      [userId]
    );
    const games = await query(
      `SELECT gp.game_id, gp.total_score, gp.rank, g.created_at as game_date
       FROM game_players gp
       JOIN games g ON g.id = gp.game_id
       WHERE gp.user_id = $1 ORDER BY g.created_at DESC LIMIT 100`,
      [userId]
    );
    return {
      user: user.rows[0] || null,
      consents: consents.rows,
      games: games.rows,
    };
  },

  // ─── Hesap Tamamen Silme ───────────────────────────────────
  async deleteUserPermanently(userId) {
    await query('DELETE FROM users WHERE id = $1', [userId]);
  },
};

module.exports = kvkkQueries;
