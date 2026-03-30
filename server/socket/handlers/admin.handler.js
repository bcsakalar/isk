const adminQueries = require('../../db/queries/admin.queries');
const logger = require('../../utils/logger');

function adminHandler(io, socket) {
  // Admin room'a katıl
  if (socket.user.role === 'admin') {
    socket.join('admin');
  }

  // Admin: Duyuru gönder
  socket.on('admin:announce', async ({ title, content, target, targetRoomId }) => {
    if (socket.user.role !== 'admin') return;

    try {
      const announcement = await adminQueries.createAnnouncement({
        adminId: socket.user.id,
        title, content,
        target: target || 'all',
        targetRoomId,
      });

      if (target === 'room' && targetRoomId) {
        io.to(`room:${targetRoomId}`).emit('announcement', { title, content });
      } else if (target === 'lobby') {
        io.to('lobby').emit('announcement', { title, content });
      } else {
        io.emit('announcement', { title, content });
      }

      await adminQueries.logAction({
        adminId: socket.user.id,
        action: 'send_announcement',
        targetType: 'system',
        details: { title, target },
      });
    } catch (err) {
      logger.error('Admin announce error', { error: err.message });
    }
  });

  // Admin: Kullanıcıyı odadan at
  socket.on('admin:kick_user', async ({ userId, roomId }) => {
    if (socket.user.role !== 'admin') return;

    try {
      const roomKey = `room:${roomId}`;
      // Hedef kullanıcının socketini bul
      const sockets = await io.in(roomKey).fetchSockets();
      for (const s of sockets) {
        if (s.user && s.user.id === userId) {
          s.emit('room:kicked', { reason: 'Admin tarafından odadan çıkarıldınız' });
          s.leave(roomKey);
          s.currentRoom = null;
          break;
        }
      }

      const roomsQueries = require('../../db/queries/rooms.queries');
      await roomsQueries.removePlayer(roomId, userId);

      io.to(roomKey).emit('room:player_kicked', { userId });

      await adminQueries.logAction({
        adminId: socket.user.id,
        action: 'kick_user',
        targetType: 'user',
        targetId: userId,
        details: { roomId },
      });
    } catch (err) {
      logger.error('Admin kick error', { error: err.message });
    }
  });

  // Admin: Oda kapat
  socket.on('admin:close_room', async ({ roomId }) => {
    if (socket.user.role !== 'admin') return;

    try {
      const roomKey = `room:${roomId}`;
      io.to(roomKey).emit('room:closed', { reason: 'Oda admin tarafından kapatıldı' });

      // Tüm socketleri odadan çıkar
      const sockets = await io.in(roomKey).fetchSockets();
      for (const s of sockets) {
        s.leave(roomKey);
        s.currentRoom = null;
      }

      const roomsQueries = require('../../db/queries/rooms.queries');
      await roomsQueries.updateStatus(roomId, 'abandoned');

      await adminQueries.logAction({
        adminId: socket.user.id,
        action: 'close_room',
        targetType: 'room',
        targetId: roomId,
      });
    } catch (err) {
      logger.error('Admin close room error', { error: err.message });
    }
  });
}

module.exports = { adminHandler };
