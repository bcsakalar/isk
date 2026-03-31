const { query, transaction } = require('../../config/database');

const roomsQueries = {
  async findById(id) {
    const result = await query('SELECT * FROM rooms WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async findByCode(code) {
    const result = await query('SELECT * FROM rooms WHERE code = $1', [code]);
    return result.rows[0] || null;
  },

  async create({ code, name, ownerId, maxPlayers, totalRounds, timePerRound, isPrivate, passwordHash, answerRevealMode, votingTimer, enabledLetters }) {
    const result = await query(
      `INSERT INTO rooms (code, name, owner_id, max_players, total_rounds, time_per_round, is_private, password_hash, answer_reveal_mode, voting_timer, enabled_letters)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [code, name, ownerId, maxPlayers, totalRounds, timePerRound, isPrivate, passwordHash, answerRevealMode || 'direct', votingTimer || 60, enabledLetters || 'A,B,C,Ç,D,E,F,G,Ğ,H,I,İ,J,K,L,M,N,O,Ö,P,R,S,Ş,T,U,Ü,V,Y,Z']
    );
    return result.rows[0];
  },

  async updateStatus(id, status) {
    await query('UPDATE rooms SET status = $2, last_activity = now() WHERE id = $1', [id, status]);
  },

  async setStarted(id) {
    await query(
      `UPDATE rooms SET status = 'playing', started_at = now(), last_activity = now() WHERE id = $1`,
      [id]
    );
  },

  async setFinished(id) {
    await query(
      `UPDATE rooms SET status = 'finished', finished_at = now(), last_activity = now() WHERE id = $1`,
      [id]
    );
  },

  async incrementRound(id) {
    const result = await query(
      `UPDATE rooms SET current_round = current_round + 1, last_activity = now()
       WHERE id = $1 RETURNING current_round`,
      [id]
    );
    return result.rows[0]?.current_round;
  },

  async updateSettings(id, settings) {
    const fields = [];
    const values = [id];
    let idx = 2;

    const allowed = ['name', 'max_players', 'total_rounds', 'time_per_round', 'voting_timer', 'answer_reveal_mode', 'enabled_letters', 'is_private', 'password_hash'];
    const columnMap = {
      name: 'name',
      max_players: 'max_players',
      total_rounds: 'total_rounds',
      time_per_round: 'time_per_round',
      voting_timer: 'voting_timer',
      answer_reveal_mode: 'answer_reveal_mode',
      enabled_letters: 'enabled_letters',
      is_private: 'is_private',
      password_hash: 'password_hash',
    };

    for (const key of allowed) {
      if (settings[key] !== undefined) {
        fields.push(`${columnMap[key]} = $${idx}`);
        values.push(settings[key]);
        idx++;
      }
    }

    if (fields.length === 0) return null;

    fields.push('last_activity = now()');
    const result = await query(
      `UPDATE rooms SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async touchActivity(id) {
    await query('UPDATE rooms SET last_activity = now() WHERE id = $1', [id]);
  },

  async listActive(limit = 50) {
    const result = await query(
      `SELECT r.id, r.code, r.name, r.owner_id, r.status, r.is_private,
              r.max_players, r.total_rounds, r.time_per_round, r.voting_timer,
              r.answer_reveal_mode, r.enabled_letters, r.current_round,
              r.created_at, r.started_at, r.finished_at, r.last_activity,
              (r.password_hash IS NOT NULL) AS has_password,
              u.display_name as owner_name,
              (SELECT COUNT(*)::integer FROM room_players rp WHERE rp.room_id = r.id AND rp.left_at IS NULL) as player_count,
              (SELECT COUNT(*)::integer FROM room_categories rc WHERE rc.room_id = r.id) as category_count
       FROM rooms r
       JOIN users u ON u.id = r.owner_id
       WHERE r.status IN ('waiting', 'playing')
       ORDER BY r.created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  },

  async listAll(limit = 100) {
    const result = await query(
      `SELECT r.id, r.code, r.name, r.owner_id, r.status, r.is_private,
              r.max_players, r.total_rounds, r.time_per_round, r.voting_timer,
              r.answer_reveal_mode, r.enabled_letters, r.current_round,
              r.created_at, r.started_at, r.finished_at, r.last_activity,
              (r.password_hash IS NOT NULL) AS has_password,
              u.display_name as owner_name,
              (SELECT COUNT(*)::integer FROM room_players rp WHERE rp.room_id = r.id AND rp.left_at IS NULL) as player_count,
              (SELECT COUNT(*)::integer FROM room_categories rc WHERE rc.room_id = r.id) as category_count
       FROM rooms r
       JOIN users u ON u.id = r.owner_id
       ORDER BY r.created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  },

  async getInactiveRooms(inactiveMinutes) {
    const minutes = parseInt(inactiveMinutes, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) return [];
    const result = await query(
      `SELECT id FROM rooms
       WHERE status IN ('waiting', 'playing', 'paused')
         AND last_activity < now() - make_interval(mins => $1)`,
      [minutes]
    );
    return result.rows.map(r => r.id);
  },

  async abandonRooms(ids) {
    if (!ids.length) return;
    await query(
      `UPDATE rooms SET status = 'abandoned', finished_at = now() WHERE id = ANY($1)`,
      [ids]
    );
  },

  async deleteOldAbandoned(days = 1) {
    const d = parseInt(days, 10);
    if (!Number.isFinite(d) || d <= 0) return;
    await query(
      `DELETE FROM rooms WHERE status IN ('abandoned', 'finished') AND finished_at < now() - make_interval(days => $1)`,
      [d]
    );
  },

  // Oda oyuncuları
  async addPlayer(roomId, userId) {
    const result = await query(
      `INSERT INTO room_players (room_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (room_id, user_id) DO UPDATE SET left_at = NULL, is_ready = FALSE
       RETURNING *`,
      [roomId, userId]
    );
    return result.rows[0];
  },

  async removePlayer(roomId, userId) {
    await query(
      `UPDATE room_players SET left_at = now() WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL`,
      [roomId, userId]
    );
  },

  async getPlayers(roomId) {
    const result = await query(
      `SELECT rp.*, u.username, u.display_name, u.avatar_url, u.level,
              (rp.user_id = (SELECT owner_id FROM rooms WHERE id = $1)) AS is_owner
       FROM room_players rp
       JOIN users u ON u.id = rp.user_id
       WHERE rp.room_id = $1 AND rp.left_at IS NULL
       ORDER BY rp.joined_at`,
      [roomId]
    );
    return result.rows;
  },

  async getPlayerCount(roomId) {
    const result = await query(
      'SELECT COUNT(*)::integer as count FROM room_players WHERE room_id = $1 AND left_at IS NULL',
      [roomId]
    );
    return result.rows[0].count;
  },

  async setPlayerReady(roomId, userId, ready) {
    await query(
      'UPDATE room_players SET is_ready = $3 WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL',
      [roomId, userId, ready]
    );
  },

  async addScore(playerId, score) {
    await query(
      'UPDATE room_players SET total_score = total_score + $2 WHERE id = $1',
      [playerId, score]
    );
  },

  async getPlayerByRoomAndUser(roomId, userId) {
    const result = await query(
      'SELECT * FROM room_players WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL',
      [roomId, userId]
    );
    return result.rows[0] || null;
  },

  // left_at dahil — bitmiş odalarda skorboard recovery için
  async getPlayerByRoomAndUserIncludeLeft(roomId, userId) {
    const result = await query(
      'SELECT * FROM room_players WHERE room_id = $1 AND user_id = $2 ORDER BY joined_at DESC LIMIT 1',
      [roomId, userId]
    );
    return result.rows[0] || null;
  },

  async getActiveRoomForUser(userId) {
    const result = await query(
      `SELECT r.id FROM room_players rp
       JOIN rooms r ON r.id = rp.room_id
       WHERE rp.user_id = $1 AND rp.left_at IS NULL
         AND r.status IN ('waiting', 'playing', 'finished')
       LIMIT 1`,
      [userId]
    );
    return result.rows[0]?.id || null;
  },

  // Oda kategorileri
  async setCategories(roomId, categoryIds) {
    await transaction(async (client) => {
      await client.query('DELETE FROM room_categories WHERE room_id = $1', [roomId]);
      for (let i = 0; i < categoryIds.length; i++) {
        await client.query(
          'INSERT INTO room_categories (room_id, category_id, sort_order) VALUES ($1, $2, $3)',
          [roomId, categoryIds[i], i]
        );
      }
    });
  },

  async getCategories(roomId) {
    const result = await query(
      `SELECT c.* FROM room_categories rc
       JOIN categories c ON c.id = rc.category_id
       WHERE rc.room_id = $1
       ORDER BY rc.sort_order`,
      [roomId]
    );
    return result.rows;
  },

  async countActive() {
    const result = await query(
      `SELECT COUNT(*)::integer as count FROM rooms WHERE status IN ('waiting', 'playing')`
    );
    return result.rows[0].count;
  },

  // Özel kategori oluştur
  async addCustomCategory(name, slug) {
    // Önce slug ile ara
    let result = await query(
      'SELECT * FROM categories WHERE slug = $1',
      [slug]
    );
    if (result.rows[0]) return result.rows[0];

    // Sonra isim ile ara
    result = await query(
      'SELECT * FROM categories WHERE name = $1',
      [name]
    );
    if (result.rows[0]) return result.rows[0];

    // Yoksa oluştur
    result = await query(
      `INSERT INTO categories (name, slug, is_default, is_active)
       VALUES ($1, $2, FALSE, TRUE)
       RETURNING *`,
      [name, slug]
    );
    return result.rows[0];
  },

  // Tek kategori ekle/çıkar
  async addCategoryToRoom(roomId, categoryId, sortOrder) {
    await query(
      `INSERT INTO room_categories (room_id, category_id, sort_order)
       VALUES ($1, $2, $3)
       ON CONFLICT (room_id, category_id) DO UPDATE SET sort_order = $3`,
      [roomId, categoryId, sortOrder]
    );
  },

  async removeCategoryFromRoom(roomId, categoryId) {
    await query(
      'DELETE FROM room_categories WHERE room_id = $1 AND category_id = $2',
      [roomId, categoryId]
    );
  },

  async getCategoryCount(roomId) {
    const result = await query(
      'SELECT COUNT(*)::integer as count FROM room_categories WHERE room_id = $1',
      [roomId]
    );
    return result.rows[0].count;
  },
};

module.exports = roomsQueries;
