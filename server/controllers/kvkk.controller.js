const kvkkService = require('../services/kvkk.service');

const kvkkController = {
  async acceptPrivacy(req, res, next) {
    try {
      const result = await kvkkService.acceptPrivacy({
        userId: req.user.id,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getPrivacyStatus(req, res, next) {
    try {
      const status = await kvkkService.getPrivacyStatus(req.user.id);
      res.json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  },

  async requestDeletion(req, res, next) {
    try {
      const { reason } = req.body;
      const result = await kvkkService.requestDeletion({
        userId: req.user.id,
        reason,
        ip: req.ip,
      });
      res.json({
        success: true,
        message: 'Hesap silme talebiniz alındı. 30 gün içinde iptal edebilirsiniz.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  async cancelDeletion(req, res, next) {
    try {
      await kvkkService.cancelDeletion(req.user.id);
      res.json({
        success: true,
        message: 'Hesap silme talebiniz iptal edildi.',
      });
    } catch (err) {
      next(err);
    }
  },

  async exportData(req, res, next) {
    try {
      const data = await kvkkService.exportData(req.user.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = kvkkController;
