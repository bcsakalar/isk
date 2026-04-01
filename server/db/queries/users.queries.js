const { query } = require('../../config/database');

const usersQueries = {
  async findById(id) {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async findByUsername(username) {
    const result = await query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0] || null;
  },

  async create({ username, email, passwordHash, displayName }) {
    const result = await query(
      `INSERT INTO users (username, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, display_name, role, xp, level, is_guest, created_at`,
      [username, email || null, passwordHash, displayName]
    );
    return result.rows[0];
  },

  async createGuest({ username, displayName, expiresAt }) {
    const result = await query(
      `INSERT INTO users (username, password_hash, display_name, role, is_guest, guest_expires_at)
       VALUES ($1, $2, $3, 'guest', TRUE, $4)
       RETURNING id, username, display_name, role, xp, level, is_guest, created_at`,
      [username, 'guest-no-login', displayName, expiresAt]
    );
    return result.rows[0];
  },

  async deleteExpiredGuests() {
    const result = await query(
      `DELETE FROM users WHERE is_guest = TRUE AND guest_expires_at < now()`
    );
    return result.rowCount;
  },

  async updateLastLogin(id) {
    await query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);
  },

  async updateProfile(id, { displayName, avatarUrl }) {
    const result = await query(
      `UPDATE users SET display_name = COALESCE($2, display_name),
                        avatar_url = COALESCE($3, avatar_url)
       WHERE id = $1
       RETURNING id, username, email, display_name, avatar_url, role, xp, level`,
      [id, displayName, avatarUrl]
    );
    return result.rows[0];
  },

  async incrementStats(id, { xp = 0, wins = 0, games = 0 }) {
    await query(
      `UPDATE users SET xp = xp + $2, total_wins = total_wins + $3,
                        total_games = total_games + $4,
                        level = GREATEST(1, FLOOR(SQRT((xp + $2) / 100.0)) + 1)
       WHERE id = $1`,
      [id, xp, wins, games]
    );
  },

  async banUser(id, reason) {
    await query('UPDATE users SET is_banned = TRUE, ban_reason = $2 WHERE id = $1', [id, reason]);
  },

  async unbanUser(id) {
    await query('UPDATE users SET is_banned = FALSE, ban_reason = NULL WHERE id = $1', [id]);
  },

  async setRole(id, role) {
    await query('UPDATE users SET role = $2 WHERE id = $1', [id, role]);
  },

  async listAllForAdmin(limit = 100) {
    const result = await query(
      `SELECT id, username, display_name, email, role, is_banned, is_guest,
              level, xp, total_wins, total_games, created_at, last_login_at
       FROM users
       WHERE is_guest = FALSE
       ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  },

  async getLeaderboard(limit = 50) {
    const result = await query(
      'SELECT id, username, display_name, avatar_url, xp, level, total_wins, total_games FROM users WHERE is_guest = FALSE AND role != $2 ORDER BY xp DESC LIMIT $1',
      [limit, 'admin']
    );
    return result.rows;
  },

  async searchUsers(term, limit = 20) {
    const result = await query(
      `SELECT id, username, display_name, role, is_banned, created_at
       FROM users WHERE username ILIKE $1 OR display_name ILIKE $1
       ORDER BY username LIMIT $2`,
      [`%${term}%`, limit]
    );
    return result.rows;
  },

  async countOnline() {
    const result = await query(
      `SELECT COUNT(DISTINCT user_id)::integer as count FROM user_sessions WHERE expires_at > now()`
    );
    return result.rows[0].count;
  },

  // ─── Account Lockout ────────────────────────────────────────
  async incrementFailedLogin(id) {
    await query(
      `UPDATE users SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1 WHERE id = $1`,
      [id]
    );
  },

  async lockAccount(id, until) {
    await query(
      `UPDATE users SET locked_until = $2, failed_login_attempts = 0 WHERE id = $1`,
      [id, until]
    );
  },

  async resetFailedLogin(id) {
    await query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
      [id]
    );
  },

  async getFailedLoginAttempts(id) {
    const result = await query(
      `SELECT failed_login_attempts, locked_until FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },
};

module.exports = usersQueries;
