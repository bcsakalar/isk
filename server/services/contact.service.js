const contactQueries = require('../db/queries/contact.queries');
const { BadRequestError, NotFoundError } = require('../utils/errors');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const contactService = {
  async submitMessage({ name, email, subject, message, ipAddress }) {
    // Validasyon
    if (!name || name.trim().length < 2 || name.trim().length > 100) {
      throw new BadRequestError('İsim 2-100 karakter arasında olmalıdır');
    }

    if (!email || !EMAIL_REGEX.test(email.trim())) {
      throw new BadRequestError('Geçerli bir e-posta adresi giriniz');
    }

    if (!subject || subject.trim().length < 2 || subject.trim().length > 200) {
      throw new BadRequestError('Konu 2-200 karakter arasında olmalıdır');
    }

    if (!message || message.trim().length < 10 || message.trim().length > 2000) {
      throw new BadRequestError('Mesaj 10-2000 karakter arasında olmalıdır');
    }

    const result = await contactQueries.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
      ipAddress,
    });

    return result;
  },

  async getMessages(limit = 50, offset = 0) {
    return contactQueries.getAll(limit, offset);
  },

  async markAsRead(id, adminId) {
    const msg = await contactQueries.getById(id);
    if (!msg) {
      throw new NotFoundError('Mesaj bulunamadı');
    }

    return contactQueries.markAsRead(id, adminId);
  },

  async getUnreadCount() {
    return contactQueries.getUnreadCount();
  },

  async deleteMessage(id) {
    const msg = await contactQueries.getById(id);
    if (!msg) {
      throw new NotFoundError('Mesaj bulunamadı');
    }
    return contactQueries.deleteById(id);
  },
};

module.exports = contactService;
