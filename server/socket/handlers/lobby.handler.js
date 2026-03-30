const roomsQueries = require('../../db/queries/rooms.queries');
const logger = require('../../utils/logger');

// Online kullanıcı takibi
const onlineUsers = new Map(); // userId -> { socketId, username, displayName }

// Özel odaları filtrele
function filterPublicRooms(rooms) {
  return rooms.filter(r => !r.has_password && !r.is_private);
}

function lobbyHandler(io, socket) {
  const userId = socket.user.id;
  const username = socket.user.username;

  // Kullanıcıyı online olarak kaydet
  onlineUsers.set(userId, {
    socketId: socket.id,
    username,
    displayName: socket.user.displayName || username,
  });

  // Lobby'e katıl
  socket.join('lobby');

  // Online sayısı güncelle
  io.to('lobby').emit('lobby:online_count', { count: onlineUsers.size });

  // Mevcut aktif odaları gönder
  roomsQueries.listActive(50).then(rooms => {
    socket.emit('lobby:rooms', { rooms: filterPublicRooms(rooms) });
  }).catch(err => {
    logger.error('Error fetching rooms for lobby', { error: err.message });
  });

  // Oda listesi yenile talebi
  socket.on('lobby:refresh', async () => {
    try {
      const rooms = await roomsQueries.listActive(50);
      socket.emit('lobby:rooms', { rooms: filterPublicRooms(rooms) });
    } catch (err) {
      logger.error('Error refreshing lobby', { error: err.message });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    onlineUsers.delete(userId);
    io.to('lobby').emit('lobby:online_count', { count: onlineUsers.size });
  });
}

function getOnlineUsers() {
  return onlineUsers;
}

function getOnlineCount() {
  return onlineUsers.size;
}

function resetOnlineUsers() {
  onlineUsers.clear();
}

module.exports = { lobbyHandler, getOnlineUsers, getOnlineCount, resetOnlineUsers };
