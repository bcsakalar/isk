const usersQueries = require('../db/queries/users.queries');
const gamesQueries = require('../db/queries/games.queries');

const userController = {
  async getMe(req, res, next) {
    try {
      const user = await usersQueries.findById(req.user.id);
      if (!user) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
      const { password_hash, ...rest } = user;
      const profile = {
        ...rest,
        total_xp: user.xp,
        games_played: user.total_games,
        games_won: user.total_wins,
        total_score: user.xp,
      };
      res.json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  },

  async getProfile(req, res, next) {
    try {
      const { userId } = req.params;
      const user = await usersQueries.findById(parseInt(userId, 10));
      if (!user) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
      const { password_hash, email, ...publicProfile } = user;
      const achievements = await gamesQueries.getUserAchievements(user.id);
      res.json({ success: true, data: { ...publicProfile, achievements } });
    } catch (err) {
      next(err);
    }
  },

  async updateProfile(req, res, next) {
    try {
      const { displayName, avatarUrl } = req.body;
      const user = await usersQueries.updateProfile(req.user.id, { displayName, avatarUrl });
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  },

  async getMyAchievements(req, res, next) {
    try {
      const achievements = await gamesQueries.getUserAchievements(req.user.id);
      res.json({ success: true, data: achievements });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = userController;
