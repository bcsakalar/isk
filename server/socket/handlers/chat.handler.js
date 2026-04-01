const gamesQueries = require('../../db/queries/games.queries');
const { sanitizeString } = require('../../middleware/sanitizer');
const { checkEventLimit } = require('../middleware/socketRateLimit');
const logger = require('../../utils/logger');

function chatHandler(io, socket) {
  // Oda mesajı
  socket.on('chat:room', async ({ message }) => {
    if (!socket.currentRoom) return;

    // Event bazlı rate limit: 3 mesaj/saniye
    if (!checkEventLimit(socket.user.id, 'chat:room')) {
      return socket.emit('chat:error', { message: 'Mesaj gönderme limiti aşıldı' });
    }

    try {
      const clean = sanitizeString(message);
      if (!clean || clean.length === 0 || clean.length > 500) return;

      const saved = await gamesQueries.saveMessage({
        roomId: socket.currentRoom,
        userId: socket.user.id,
        message: clean,
      });

      const roomKey = `room:${socket.currentRoom}`;
      io.to(roomKey).emit('chat:room_message', {
        id: saved.id,
        userId: socket.user.id,
        displayName: socket.user.displayName || socket.user.username,
        message: clean,
        createdAt: saved.created_at,
      });
    } catch (err) {
      logger.error('Chat room error', { error: err.message });
    }
  });

  // Emoji tepkisi
  socket.on('chat:reaction', ({ emoji }) => {
    if (!socket.currentRoom) return;

    const allowedEmojis = ['👍', '👏', '😂', '😮', '😡', '🔥', '💯', '⭐'];
    if (!allowedEmojis.includes(emoji)) return;

    const roomKey = `room:${socket.currentRoom}`;
    io.to(roomKey).emit('chat:reaction', {
      userId: socket.user.id,
      displayName: socket.user.displayName || socket.user.username,
      emoji,
    });
  });

  // Mesaj geçmişi
  socket.on('chat:history', async ({ roomId, limit }) => {
    try {
      // Client room code gönderebilir, sunucu tarafında numeric room id kullan
      const numericRoomId = socket.currentRoom || null;
      const messages = await gamesQueries.getMessages(numericRoomId, Math.min(limit || 50, 100));
      socket.emit('chat:history', { messages, roomId: roomId || null });
    } catch (err) {
      logger.error('Chat history error', { error: err.message });
    }
  });
}

module.exports = { chatHandler };
