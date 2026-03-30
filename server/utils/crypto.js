const crypto = require('crypto');

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // karışıklık yaratan 0/O, 1/I/L hariç
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

function generateToken(length = 48) {
  return crypto.randomBytes(length).toString('hex');
}

module.exports = { generateRoomCode, generateToken };
