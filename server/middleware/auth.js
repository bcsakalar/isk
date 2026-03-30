const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const usersQueries = require('../db/queries/users.queries');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return next(new UnauthorizedError('Erişim token\'ı gerekli'));
  }

  try {
    const decoded = jwt.verify(token, env.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token süresi dolmuş'));
    }
    return next(new UnauthorizedError('Geçersiz token'));
  }
}

// Kullanıcının banlı olup olmadığını kontrol et
async function checkBan(req, res, next) {
  try {
    const user = await usersQueries.findById(req.user.id);
    if (!user) return next(new UnauthorizedError('Kullanıcı bulunamadı'));
    if (user.is_banned) return next(new UnauthorizedError('Hesabınız yasaklanmış: ' + (user.ban_reason || '')));
    next();
  } catch (err) {
    next(err);
  }
}

// Opsiyonel auth — token varsa parse et, yoksa devam et
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return next();

  try {
    req.user = jwt.verify(token, env.jwt.secret);
  } catch (_) {
    // Geçersiz token sessizce devam eder
  }
  next();
}

// Misafir kullanıcıları engelle
function denyGuests(req, res, next) {
  if (req.user && req.user.role === 'guest') {
    return next(new ForbiddenError('Misafir kullanıcılar bu işlemi yapamaz'));
  }
  next();
}

module.exports = { authenticateToken, checkBan, optionalAuth, denyGuests };
