const { query } = require('../../config/database');

const contactQueries = {
  async create({ name, email, subject, message, ipAddress }) {
    const result = await query(
      `INSERT INTO contact_messages (name, email, subject, message, ip_address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, email, subject, message, ipAddress || null]
    );
    return result.rows[0];
  },

  async getAll(limit = 50, offset = 0) {
    const result = await query(
      `SELECT cm.*, u.username AS read_by_username
       FROM contact_messages cm
       LEFT JOIN users u ON cm.read_by = u.id
       ORDER BY cm.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  },

  async getById(id) {
    const result = await query(
      'SELECT * FROM contact_messages WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  async markAsRead(id, adminId) {
    const result = await query(
      `UPDATE contact_messages
       SET is_read = TRUE, read_by = $2, read_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, adminId]
    );
    return result.rows[0] || null;
  },

  async getUnreadCount() {
    const result = await query(
      'SELECT COUNT(*)::integer AS count FROM contact_messages WHERE is_read = FALSE'
    );
    return result.rows[0].count;
  },

  async deleteById(id) {
    const result = await query(
      'DELETE FROM contact_messages WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows[0] || null;
  },
};

module.exports = contactQueries;
