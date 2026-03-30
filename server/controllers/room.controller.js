const roomService = require('../services/room.service');

const roomController = {
  async create(req, res, next) {
    try {
      const { name, maxPlayers, totalRounds, timePerRound, isPrivate, password, categoryIds, answerRevealMode, votingTimer, enabledLetters } = req.body;
      const room = await roomService.createRoom({
        userId: req.user.id,
        name, maxPlayers, totalRounds, timePerRound, isPrivate, password, categoryIds,
        answerRevealMode, votingTimer, enabledLetters,
      });
      res.status(201).json({ success: true, data: room });
    } catch (err) {
      next(err);
    }
  },

  async join(req, res, next) {
    try {
      const { code, password } = req.body;
      const result = await roomService.joinRoom({ userId: req.user.id, code, password });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async leave(req, res, next) {
    try {
      const { roomId } = req.params;
      const result = await roomService.leaveRoom({ userId: req.user.id, roomId: parseInt(roomId, 10) });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const { roomId } = req.params;
      const room = await roomService.getRoom(parseInt(roomId, 10));
      res.json({ success: true, data: room });
    } catch (err) {
      next(err);
    }
  },

  async getPreview(req, res, next) {
    try {
      const { code } = req.params;
      const room = await roomService.getRoomByCode(code);
      // Return limited info (no password, no internal IDs)
      res.json({
        success: true,
        data: {
          code: room.code,
          name: room.name,
          status: room.status,
          is_private: room.is_private,
          max_players: room.max_players,
          total_rounds: room.total_rounds,
          time_per_round: room.time_per_round,
          voting_timer: room.voting_timer ?? 60,
          answer_reveal_mode: room.answer_reveal_mode || 'direct',
          player_count: (room.players || []).length,
          category_count: (room.categories || []).length,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async getByCode(req, res, next) {
    try {
      const { code } = req.params;
      const room = await roomService.getRoomByCode(code);
      res.json({ success: true, data: room });
    } catch (err) {
      next(err);
    }
  },

  async list(req, res, next) {
    try {
      const rooms = await roomService.listActiveRooms();
      res.json({ success: true, data: rooms });
    } catch (err) {
      next(err);
    }
  },

  async listPublic(req, res, next) {
    try {
      const rooms = await roomService.listPublicRooms();
      res.json({ success: true, data: rooms });
    } catch (err) {
      next(err);
    }
  },

  async setReady(req, res, next) {
    try {
      const { roomId } = req.params;
      const { ready } = req.body;
      const result = await roomService.setReady(parseInt(roomId, 10), req.user.id, ready !== false);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async updateSettings(req, res, next) {
    try {
      const { roomId } = req.params;
      const result = await roomService.updateSettings(parseInt(roomId, 10), req.user.id, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async updateCategories(req, res, next) {
    try {
      const { roomId } = req.params;
      const { categoryIds } = req.body;
      const categories = await roomService.updateCategories(parseInt(roomId, 10), req.user.id, categoryIds);
      res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  },

  async addCategory(req, res, next) {
    try {
      const { roomId } = req.params;
      const { name } = req.body;
      const categories = await roomService.addCategory(parseInt(roomId, 10), req.user.id, name);
      res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  },

  async removeCategory(req, res, next) {
    try {
      const { roomId, categoryId } = req.params;
      const categories = await roomService.removeCategory(parseInt(roomId, 10), req.user.id, categoryId);
      res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  },

  async updateLetters(req, res, next) {
    try {
      const { roomId } = req.params;
      const { letters } = req.body;
      const result = await roomService.updateLetters(parseInt(roomId, 10), req.user.id, letters);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = roomController;
