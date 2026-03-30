const authService = require('../services/auth.service');

const authController = {
  async register(req, res, next) {
    try {
      const { username, password, displayName } = req.body;
      const result = await authService.register({ username, password, displayName });
      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async guestLogin(req, res, next) {
    try {
      const { nickname } = req.body;
      const result = await authService.guestLogin({ nickname });
      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const { username, password } = req.body;
      const ip = req.ip;
      const userAgent = req.get('user-agent');
      const result = await authService.login({ username, password, ip, userAgent });
      res.json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);
      res.json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async logout(req, res, next) {
    try {
      const { refreshToken } = req.body;
      await authService.logout(refreshToken);
      res.json({ success: true, message: 'Çıkış yapıldı' });
    } catch (err) {
      next(err);
    }
  },

  async me(req, res, next) {
    try {
      const usersQueries = require('../db/queries/users.queries');
      const user = await usersQueries.findById(req.user.id);
      if (!user) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
      const { password_hash, ...safeUser } = user;
      res.json({ success: true, data: safeUser });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = authController;
