const { ForbiddenError } = require('../utils/errors');

function adminGuard(req, res, next) {
  if (!req.user) {
    return next(new ForbiddenError('Yetkisiz erişim'));
  }
  if (req.user.role !== 'admin') {
    return next(new ForbiddenError('Bu işlem için admin yetkisi gerekli'));
  }
  next();
}

function moderatorGuard(req, res, next) {
  if (!req.user) {
    return next(new ForbiddenError('Yetkisiz erişim'));
  }
  if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return next(new ForbiddenError('Bu işlem için moderatör yetkisi gerekli'));
  }
  next();
}

module.exports = { adminGuard, moderatorGuard };
