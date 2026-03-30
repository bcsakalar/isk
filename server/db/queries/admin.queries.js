const { query } = require('../../config/database');

const adminQueries = {
  async logAction({ adminId, action, targetType, targetId, details, ipAddress }) {
    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [adminId, action, targetType || null, targetId || null, details ? JSON.stringify(details) : null, ipAddress || null]
    );
  },

  async getLogs(limit = 100, offset = 0) {
    const result = await query(
      `SELECT al.*, u.display_name as admin_name
       FROM admin_logs al
       JOIN users u ON u.id = al.admin_id
       ORDER BY al.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  },

  async createAnnouncement({ adminId, title, content, target, targetRoomId, expiresAt }) {
    const result = await query(
      `INSERT INTO announcements (admin_id, title, content, target, target_room_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [adminId, title, content, target, targetRoomId || null, expiresAt || null]
    );
    return result.rows[0];
  },

  async getActiveAnnouncements() {
    const result = await query(
      `SELECT a.*, u.display_name as admin_name, r.code as room_code, r.name as room_name
       FROM announcements a
       JOIN users u ON u.id = a.admin_id
       LEFT JOIN rooms r ON r.id = a.target_room_id
       WHERE a.is_active = TRUE AND (a.expires_at IS NULL OR a.expires_at > now())
       ORDER BY a.created_at DESC`
    );
    return result.rows;
  },

  async deactivateAnnouncement(id) {
    await query('UPDATE announcements SET is_active = FALSE WHERE id = $1', [id]);
  },

  async getStats() {
    const result = await query(`
      SELECT
        (SELECT COUNT(*)::integer FROM users WHERE is_guest = FALSE) as total_users,
        (SELECT COUNT(*)::integer FROM users WHERE last_login_at > now() - interval '24 hours') as active_users_24h,
        (SELECT COUNT(*)::integer FROM rooms WHERE status IN ('waiting', 'playing')) as active_rooms,
        (SELECT COUNT(*)::integer FROM rooms) as total_rooms,
        (SELECT COUNT(*)::integer FROM users WHERE is_banned = TRUE) as banned_users
    `);
    return result.rows[0];
  },

  // Raporlar
  async createReport({ reporterId, reportedUserId, roomId, reason }) {
    const result = await query(
      `INSERT INTO reports (reporter_id, reported_user_id, room_id, reason) VALUES ($1, $2, $3, $4) RETURNING *`,
      [reporterId, reportedUserId, roomId || null, reason]
    );
    return result.rows[0];
  },

  async getReports(status = null, limit = 50) {
    let sql = `SELECT r.*, reporter.display_name as reporter_name, reported.display_name as reported_name
               FROM reports r
               JOIN users reporter ON reporter.id = r.reporter_id
               JOIN users reported ON reported.id = r.reported_user_id`;
    const params = [];
    if (status) {
      sql += ' WHERE r.status = $1';
      params.push(status);
    }
    sql += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    const result = await query(sql, params);
    return result.rows;
  },

  async reviewReport(id, { status, adminNote, reviewedBy }) {
    await query(
      `UPDATE reports SET status = $2, admin_note = $3, reviewed_by = $4, reviewed_at = now() WHERE id = $1`,
      [id, status, adminNote, reviewedBy]
    );
  },

  async deleteAnnouncement(id) {
    const result = await query('DELETE FROM announcements WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
  },

  async clearLogs() {
    const result = await query('DELETE FROM admin_logs');
    return result.rowCount;
  },

  // Oturum temizleme
  async cleanExpiredSessions() {
    const result = await query('DELETE FROM user_sessions WHERE expires_at < now()');
    return result.rowCount;
  },
};

module.exports = adminQueries;
