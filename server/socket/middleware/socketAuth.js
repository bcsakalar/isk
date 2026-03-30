const jwt = require('jsonwebtoken');
const env = require('../../config/env');

function socketAuth(socket, next) {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;

  if (!token) {
    return next(new Error('Erişim token\'ı gerekli'));
  }

  try {
    const decoded = jwt.verify(token, env.jwt.secret);
    socket.user = decoded;
    next();
  } catch (err) {
    return next(new Error('Geçersiz veya süresi dolmuş token'));
  }
}

module.exports = socketAuth;
