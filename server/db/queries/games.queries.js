const { query, transaction } = require('../../config/database');

const gamesQueries = {
  // Turlar
  async createRound({ roomId, roundNumber, letter }) {
    const result = await query(
      `INSERT INTO game_rounds (room_id, round_number, letter)
       VALUES ($1, $2, $3) RETURNING *`,
      [roomId, roundNumber, letter]
    );
    return result.rows[0];
  },

  async finishRound(roundId) {
    await query(
      'UPDATE game_rounds SET finished_at = now() WHERE id = $1',
      [roundId]
    );
  },

  async getCurrentRound(roomId) {
    const result = await query(
      `SELECT * FROM game_rounds WHERE room_id = $1 AND finished_at IS NULL ORDER BY round_number DESC LIMIT 1`,
      [roomId]
    );
    return result.rows[0] || null;
  },

  async getLatestRound(roomId) {
    const result = await query(
      `SELECT * FROM game_rounds WHERE room_id = $1 ORDER BY round_number DESC LIMIT 1`,
      [roomId]
    );
    return result.rows[0] || null;
  },

  async getRoundsByRoom(roomId) {
    const result = await query(
      'SELECT * FROM game_rounds WHERE room_id = $1 ORDER BY round_number',
      [roomId]
    );
    return result.rows;
  },

  async setGhostLetter(roundId, ghostLetter) {
    // Ghost letter kaldırıldı — noop
  },

  // Cevaplar
  async submitAnswer({ roundId, playerId, categoryId, answer }) {
    const result = await query(
      `INSERT INTO player_answers (round_id, player_id, category_id, answer)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (round_id, player_id, category_id) DO UPDATE SET answer = $4, submitted_at = now()
       RETURNING *`,
      [roundId, playerId, categoryId, answer]
    );
    return result.rows[0];
  },

  async getAnswersForRound(roundId) {
    const result = await query(
      `SELECT pa.*, rp.user_id, u.display_name, c.name as category_name, c.slug as category_slug
       FROM player_answers pa
       JOIN room_players rp ON rp.id = pa.player_id
       JOIN users u ON u.id = rp.user_id
       JOIN categories c ON c.id = pa.category_id
       JOIN game_rounds gr ON gr.id = pa.round_id
       JOIN room_categories rc ON rc.room_id = gr.room_id AND rc.category_id = pa.category_id
       WHERE pa.round_id = $1
       ORDER BY rc.sort_order, rp.user_id`,
      [roundId]
    );
    return result.rows;
  },

  async getPlayerAnswersForRound(roundId, playerId) {
    const result = await query(
      'SELECT * FROM player_answers WHERE round_id = $1 AND player_id = $2',
      [roundId, playerId]
    );
    return result.rows;
  },

  async updateAnswerScore(answerId, { isValid, isUnique, baseScore, voteScore, isDuplicate }) {
    await query(
      `UPDATE player_answers SET is_valid = $2, is_unique = $3, base_score = $4, vote_score = $5, is_duplicate = $6
       WHERE id = $1`,
      [answerId, isValid, isUnique, baseScore, voteScore || 0, isDuplicate || false]
    );
  },

  // Kategoriler
  async getAllCategories() {
    const result = await query('SELECT * FROM categories WHERE is_active = TRUE ORDER BY id');
    return result.rows;
  },

  async getDefaultCategories() {
    const result = await query(
      'SELECT * FROM categories WHERE is_active = TRUE AND is_default = TRUE ORDER BY id'
    );
    return result.rows;
  },

  // Sohbet
  async saveMessage({ roomId, userId, message, isSystem }) {
    const result = await query(
      `INSERT INTO chat_messages (room_id, user_id, message, is_system)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [roomId || null, userId, message, isSystem || false]
    );
    return result.rows[0];
  },

  async getMessages(roomId, limit = 50) {
    const limitParam = roomId ? '$2' : '$1';
    const result = await query(
      `SELECT cm.*, u.display_name, u.avatar_url
       FROM chat_messages cm
       JOIN users u ON u.id = cm.user_id
       WHERE ${roomId ? 'cm.room_id = $1' : 'cm.room_id IS NULL'}
         AND cm.is_deleted = FALSE
       ORDER BY cm.created_at DESC LIMIT ${limitParam}`,
      roomId ? [roomId, limit] : [limit]
    );
    return result.rows.reverse();
  },

  async deleteMessage(messageId) {
    await query('UPDATE chat_messages SET is_deleted = TRUE WHERE id = $1', [messageId]);
  },

  async purgeOldMessages(days) {
    const result = await query(
      `DELETE FROM chat_messages WHERE created_at < now() - ($1 || ' days')::interval`,
      [days]
    );
    return result.rowCount;
  },

  // Leaderboard
  async upsertLeaderboard({ userId, season, periodType, score, wins, gamesPlayed }) {
    await query(
      `INSERT INTO leaderboard (user_id, season, period_type, total_score, total_wins, games_played)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, season, period_type)
       DO UPDATE SET total_score = leaderboard.total_score + $4,
                     total_wins = leaderboard.total_wins + $5,
                     games_played = leaderboard.games_played + $6`,
      [userId, season, periodType, score, wins, gamesPlayed]
    );
  },

  async getLeaderboard(season, periodType, limit = 50) {
    const result = await query(
      `SELECT lb.*, u.username, u.display_name, u.avatar_url, u.level
       FROM leaderboard lb
       JOIN users u ON u.id = lb.user_id
       WHERE lb.season = $1 AND lb.period_type = $2
       ORDER BY lb.total_score DESC LIMIT $3`,
      [season, periodType, limit]
    );
    return result.rows;
  },

  // Başarımlar
  async getAchievements() {
    const result = await query('SELECT * FROM achievements WHERE is_active = TRUE ORDER BY id');
    return result.rows;
  },

  async getUserAchievements(userId) {
    const result = await query(
      `SELECT a.*, ua.earned_at FROM user_achievements ua
       JOIN achievements a ON a.id = ua.achievement_id
       WHERE ua.user_id = $1 ORDER BY ua.earned_at DESC`,
      [userId]
    );
    return result.rows;
  },

  async grantAchievement(userId, achievementId) {
    await query(
      `INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, achievementId]
    );
  },

  // ==============================
  // İtiraz (Challenge) Sistemi
  // ==============================

  async addChallenge(answerId, challengerId) {
    const result = await query(
      `INSERT INTO answer_challenges (answer_id, challenger_id)
       VALUES ($1, $2)
       ON CONFLICT (answer_id, challenger_id) DO NOTHING
       RETURNING *`,
      [answerId, challengerId]
    );
    return result.rows[0] || null;
  },

  async removeChallenge(answerId, challengerId) {
    const result = await query(
      `DELETE FROM answer_challenges WHERE answer_id = $1 AND challenger_id = $2 RETURNING *`,
      [answerId, challengerId]
    );
    return result.rows[0] || null;
  },

  async getChallengesForRound(roundId) {
    const result = await query(
      `SELECT ac.*, ac.answer_id, ac.challenger_id
       FROM answer_challenges ac
       JOIN player_answers pa ON pa.id = ac.answer_id
       WHERE pa.round_id = $1`,
      [roundId]
    );
    return result.rows;
  },

  async getChallengeCountsForRound(roundId) {
    const result = await query(
      `SELECT ac.answer_id, COUNT(*)::int as challenge_count,
              ARRAY_AGG(ac.challenger_id) as challenger_ids
       FROM answer_challenges ac
       JOIN player_answers pa ON pa.id = ac.answer_id
       WHERE pa.round_id = $1
       GROUP BY ac.answer_id`,
      [roundId]
    );
    return result.rows;
  },

  async markAnswerChallenged(answerId) {
    await query(
      `UPDATE player_answers SET is_challenged = TRUE, base_score = 0, is_valid = FALSE WHERE id = $1`,
      [answerId]
    );
  },

  async getDetailedAnswersForRound(roundId) {
    const result = await query(
      `SELECT pa.id as answer_id, pa.round_id, pa.player_id, pa.category_id,
              pa.answer, pa.is_valid, pa.is_unique, pa.base_score, pa.vote_score,
              pa.is_duplicate, pa.is_revealed,
              rp.user_id, u.username, u.display_name,
              c.name as category_name, c.slug as category_slug
       FROM player_answers pa
       JOIN room_players rp ON rp.id = pa.player_id
       JOIN users u ON u.id = rp.user_id
       JOIN categories c ON c.id = pa.category_id
       JOIN game_rounds gr ON gr.id = pa.round_id
       JOIN room_categories rc ON rc.room_id = gr.room_id AND rc.category_id = pa.category_id
       WHERE pa.round_id = $1
       ORDER BY rc.sort_order, rp.user_id`,
      [roundId]
    );
    return result.rows;
  },

  // ==============================
  // Oylama (Vote) Sistemi
  // ==============================

  async addVote(answerId, voterId, voteType) {
    const result = await query(
      `INSERT INTO answer_votes (answer_id, voter_id, vote_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (answer_id, voter_id) DO UPDATE SET vote_type = $3
       RETURNING *`,
      [answerId, voterId, voteType]
    );
    return result.rows[0];
  },

  async removeVote(answerId, voterId) {
    const result = await query(
      'DELETE FROM answer_votes WHERE answer_id = $1 AND voter_id = $2 RETURNING *',
      [answerId, voterId]
    );
    return result.rows[0] || null;
  },

  async getVotesForRound(roundId) {
    const result = await query(
      `SELECT av.*, pa.category_id, pa.player_id as answer_owner_id
       FROM answer_votes av
       JOIN player_answers pa ON pa.id = av.answer_id
       WHERE pa.round_id = $1`,
      [roundId]
    );
    return result.rows;
  },

  async getVoteCountsForAnswer(answerId) {
    const result = await query(
      `SELECT
         COUNT(*) FILTER (WHERE vote_type = 'positive')::int as positive,
         COUNT(*) FILTER (WHERE vote_type = 'negative')::int as negative
       FROM answer_votes WHERE answer_id = $1`,
      [answerId]
    );
    return result.rows[0] || { positive: 0, negative: 0 };
  },

  async getVoteCountsForRound(roundId) {
    const result = await query(
      `SELECT av.answer_id,
         COUNT(*) FILTER (WHERE av.vote_type = 'positive')::int as positive,
         COUNT(*) FILTER (WHERE av.vote_type = 'negative')::int as negative
       FROM answer_votes av
       JOIN player_answers pa ON pa.id = av.answer_id
       WHERE pa.round_id = $1
       GROUP BY av.answer_id`,
      [roundId]
    );
    return result.rows;
  },

  // ==============================
  // Kanıt Resimleri
  // ==============================

  async addImage(answerId, uploaderId, imageData, mimeType) {
    // Max 3 resim kontrolü
    const countResult = await query(
      'SELECT COUNT(*)::int as count FROM answer_images WHERE answer_id = $1',
      [answerId]
    );
    if (countResult.rows[0].count >= 3) return null;

    const result = await query(
      `INSERT INTO answer_images (answer_id, uploaded_by, image_data, mime_type)
       VALUES ($1, $2, $3, $4) RETURNING id, answer_id, uploaded_by, mime_type, created_at`,
      [answerId, uploaderId, imageData, mimeType || 'image/jpeg']
    );
    return result.rows[0];
  },

  async getImagesForAnswer(answerId) {
    const result = await query(
      'SELECT id, answer_id, uploaded_by, mime_type, created_at FROM answer_images WHERE answer_id = $1 ORDER BY created_at',
      [answerId]
    );
    return result.rows;
  },

  async getImageData(imageId) {
    const result = await query(
      'SELECT * FROM answer_images WHERE id = $1',
      [imageId]
    );
    return result.rows[0] || null;
  },

  async getImagesForRound(roundId) {
    const result = await query(
      `SELECT ai.id, ai.answer_id, ai.uploaded_by, ai.mime_type, ai.created_at
       FROM answer_images ai
       JOIN player_answers pa ON pa.id = ai.answer_id
       WHERE pa.round_id = $1
       ORDER BY ai.created_at`,
      [roundId]
    );
    return result.rows;
  },

  // ==============================
  // Batch İşlemler (Performans)
  // ==============================

  /**
   * Tek INSERT ile birden fazla boş cevap ekle.
   * entries = [{ playerId, categoryId }, ...]
   * ON CONFLICT DO NOTHING: mevcut cevapları ezmez.
   */
  async submitEmptyAnswersBatch(roundId, entries) {
    if (!entries.length) return;

    const values = [];
    const params = [roundId]; // $1 = roundId
    let paramIdx = 2;

    for (const entry of entries) {
      values.push(`($1, $${paramIdx}, $${paramIdx + 1}, '')`);
      params.push(entry.playerId, entry.categoryId);
      paramIdx += 2;
    }

    await query(
      `INSERT INTO player_answers (round_id, player_id, category_id, answer)
       VALUES ${values.join(', ')}
       ON CONFLICT (round_id, player_id, category_id) DO NOTHING`,
      params
    );
  },

  /**
   * Boş cevaplara otomatik olumsuz oy ekle (batch).
   * entries = [{ answerId, voterId }, ...]
   * ON CONFLICT DO NOTHING: mevcut oyları ezmez.
   */
  async addAutoNegativeVotesBatch(entries) {
    if (!entries.length) return;

    const values = [];
    const params = [];
    let paramIdx = 1;

    for (const entry of entries) {
      values.push(`($${paramIdx}, $${paramIdx + 1}, 'negative')`);
      params.push(entry.answerId, entry.voterId);
      paramIdx += 2;
    }

    await query(
      `INSERT INTO answer_votes (answer_id, voter_id, vote_type)
       VALUES ${values.join(', ')}
       ON CONFLICT (answer_id, voter_id) DO NOTHING`,
      params
    );
  },

  /**
   * Tek query ile birden fazla cevabın skorlarını güncelle.
   * updates = [{ answerId, isValid, isUnique, baseScore, voteScore, isDuplicate }, ...]
   */
  async batchUpdateAnswerScores(updates) {
    if (!updates.length) return;

    const values = [];
    const params = [];
    let paramIdx = 1;

    for (const u of updates) {
      values.push(`($${paramIdx}::bigint, $${paramIdx + 1}::boolean, $${paramIdx + 2}::boolean, $${paramIdx + 3}::integer, $${paramIdx + 4}::integer, $${paramIdx + 5}::boolean)`);
      params.push(u.answerId, u.isValid, u.isUnique, u.baseScore, u.voteScore || 0, u.isDuplicate || false);
      paramIdx += 6;
    }

    await query(
      `UPDATE player_answers AS pa SET
         is_valid = v.is_valid,
         is_unique = v.is_unique,
         base_score = v.base_score,
         vote_score = v.vote_score,
         is_duplicate = v.is_duplicate
       FROM (VALUES ${values.join(', ')})
         AS v(id, is_valid, is_unique, base_score, vote_score, is_duplicate)
       WHERE pa.id = v.id`,
      params
    );
  },

  /**
   * Tek query ile birden fazla oyuncunun skorlarını artır.
   * scoreEntries = [{ playerId, score }, ...]
   */
  async batchAddScores(scoreEntries) {
    if (!scoreEntries.length) return;

    const values = [];
    const params = [];
    let paramIdx = 1;

    for (const entry of scoreEntries) {
      values.push(`($${paramIdx}::bigint, $${paramIdx + 1}::integer)`);
      params.push(entry.playerId, entry.score);
      paramIdx += 2;
    }

    await query(
      `UPDATE room_players AS rp SET
         total_score = rp.total_score + v.score
       FROM (VALUES ${values.join(', ')})
         AS v(id, score)
       WHERE rp.id = v.id`,
      params
    );
  },

  // Oylama zamanları
  async setVotingStarted(roundId) {
    await query(
      'UPDATE game_rounds SET voting_started_at = now() WHERE id = $1',
      [roundId]
    );
  },

  async setVotingFinished(roundId) {
    await query(
      'UPDATE game_rounds SET voting_finished_at = now() WHERE id = $1',
      [roundId]
    );
  },

  async getVotesWithNamesForRound(roundId) {
    const result = await query(
      `SELECT av.answer_id, av.voter_id, av.vote_type,
              u.display_name as voter_name, u.id as voter_user_id
       FROM answer_votes av
       JOIN users u ON u.id = av.voter_id
       JOIN player_answers pa ON pa.id = av.answer_id
       WHERE pa.round_id = $1`,
      [roundId]
    );
    return result.rows;
  },
};

module.exports = gamesQueries;
