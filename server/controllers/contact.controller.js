const contactService = require('../services/contact.service');

const contactController = {
  async submit(req, res, next) {
    try {
      const { name, email, subject, message } = req.body;
      const result = await contactService.submitMessage({
        name,
        email,
        subject,
        message,
        ipAddress: req.ip,
      });
      res.status(201).json({ success: true, data: { id: result.id }, message: 'Mesajınız başarıyla gönderildi' });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = contactController;
