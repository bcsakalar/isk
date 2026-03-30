const gameService = require('../services/game.service');
const gamesQueries = require('../db/queries/games.queries');
const roomsQueries = require('../db/queries/rooms.queries');
const logger = require('../utils/logger');

const gameController = {
  async start(req, res, next) {
    try {
      const { roomId } = req.params;
      const result = await gameService.startGame(parseInt(roomId, 10), req.user.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async submitAnswers(req, res, next) {
    try {
      const { roomId } = req.params;
      const { answers } = req.body;
      const result = await gameService.submitAnswers(parseInt(roomId, 10), req.user.id, answers || []);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getRoundResults(req, res, next) {
    try {
      const { roundId } = req.params;
      const answers = await gamesQueries.getDetailedAnswersForRound(parseInt(roundId, 10));
      res.json({ success: true, data: answers });
    } catch (err) {
      next(err);
    }
  },

  async vote(req, res, next) {
    try {
      const { roomId } = req.params;
      const { answerId, voteType } = req.body;
      const result = await gameService.submitVote(parseInt(roomId, 10), req.user.id, answerId, voteType);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async removeVote(req, res, next) {
    try {
      const { roomId } = req.params;
      const { answerId } = req.body;
      const result = await gameService.removeVote(parseInt(roomId, 10), req.user.id, answerId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async uploadImage(req, res, next) {
    try {
      const { roomId } = req.params;
      const { answerId, imageData, mimeType } = req.body;
      const result = await gameService.uploadImage(
        parseInt(roomId, 10), req.user.id, answerId, imageData, mimeType
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getImage(req, res, next) {
    try {
      const { imageId } = req.params;
      const image = await gamesQueries.getImageData(parseInt(imageId, 10));
      if (!image) return res.status(404).json({ success: false, error: 'Görsel bulunamadı' });
      res.json({ success: true, data: image });
    } catch (err) {
      next(err);
    }
  },

  async getRecoveryState(req, res, next) {
    try {
      const { code } = req.params;
      const state = await gameService.getRecoveryState(code, req.user.id);
      logger.debug('Recovery state returned', { code, userId: req.user.id, phase: state.phase });
      res.json({ success: true, data: state });
    } catch (err) {
      logger.warn('Recovery state failed', { code: req.params.code, userId: req.user?.id, error: err.message });
      next(err);
    }
  },

  async getCategories(req, res, next) {
    try {
      const categories = await gamesQueries.getDefaultCategories();
      res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  },

  async getLeaderboard(req, res, next) {
    try {
      const { period, season, periodType, limit } = req.query;
      const maxLimit = Math.min(parseInt(limit) || 50, 100);

      // Frontend "period" parametresi destekle
      if (period === 'all' || (!period && !season)) {
        // Tüm zamanlar: users tablosundan XP sıralaması
        const usersQueries = require('../db/queries/users.queries');
        const lb = await usersQueries.getLeaderboard(maxLimit);
        // Frontend'in beklediği alan adlarına map et
        const mapped = lb.map(u => ({
          user_id: u.id,
          username: u.username,
          display_name: u.display_name,
          avatar_url: u.avatar_url,
          level: u.level,
          total_xp: u.xp,
          total_score: u.xp,
          total_wins: u.total_wins,
          games_played: u.total_games,
        }));
        return res.json({ success: true, data: mapped });
      }

      if (period === 'weekly') {
        // Haftalık: leaderboard tablosundan güncel hafta
        const now = new Date();
        const weekNum = Math.ceil(((now - new Date(now.getFullYear(), 0, 1)) / 86400000 + 1) / 7);
        const weeklySeason = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
        const lb = await gamesQueries.getLeaderboard(weeklySeason, 'weekly', maxLimit);
        const mapped = lb.map(row => ({
          ...row,
          total_xp: row.total_score,
          games_played: row.games_played,
        }));
        return res.json({ success: true, data: mapped });
      }

      // Eski format (season + periodType) — geriye uyumluluk
      const now = new Date();
      const defaultSeason = `${now.getFullYear()}-M${String(now.getMonth() + 1).padStart(2, '0')}`;
      const lb = await gamesQueries.getLeaderboard(season || defaultSeason, periodType || 'monthly', maxLimit);
      res.json({ success: true, data: lb });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = gameController;
