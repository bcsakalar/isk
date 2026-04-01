const { ForbiddenError } = require('../utils/errors');
const usersQueries = require('../db/queries/users.queries');

async function adminGuard(req, res, next) {
  if (!req.user) {
    return next(new ForbiddenError('Yetkisiz erişim'));
  }

  // JWT'deki role claim'i DB'den doğrula (privilege escalation penceresini kapat)
  try {
    const user = await usersQueries.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return next(new ForbiddenError('Bu işlem için admin yetkisi gerekli'));
    }
    // req.user.role'u DB'den güncelle
    req.user.role = user.role;
  } catch {
    return next(new ForbiddenError('Yetki doğrulama hatası'));
  }

  next();
}

async function moderatorGuard(req, res, next) {
  if (!req.user) {
    return next(new ForbiddenError('Yetkisiz erişim'));
  }

  try {
    const user = await usersQueries.findById(req.user.id);
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
      return next(new ForbiddenError('Bu işlem için moderatör yetkisi gerekli'));
    }
    req.user.role = user.role;
  } catch {
    return next(new ForbiddenError('Yetki doğrulama hatası'));
  }

  next();
}

module.exports = { adminGuard, moderatorGuard };
