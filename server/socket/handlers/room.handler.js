const roomService = require('../../services/room.service');
const roomsQueries = require('../../db/queries/rooms.queries');
const { clearRoomTimer, clearVotingTimer } = require('./game.handler');
const logger = require('../../utils/logger');

// ─── Disconnect Grace Period ─────────────────────────────────────
// Sayfa yenileme veya kısa süreli bağlantı kopması durumunda
// oyuncuyu hemen odadan çıkarmak yerine belirli bir süre bekle.
let DISCONNECT_GRACE_PLAYING = 30000; // 30s — oyun devam ederken
let DISCONNECT_GRACE_WAITING = 15000; // 15s — bekleme odasında

function setGracePeriods(playing, waiting) {
  DISCONNECT_GRACE_PLAYING = playing;
  DISCONNECT_GRACE_WAITING = waiting;
}

// userId -> { timerId, roomId, socketId }
const pendingDisconnects = new Map();

function clearPendingDisconnect(userId) {
  const pending = pendingDisconnects.get(userId);
  if (pending) {
    clearTimeout(pending.timerId);
    pendingDisconnects.delete(userId);
    return pending;
  }
  return null;
}

// Özel odaları lobiden filtrele
function filterPublicRooms(rooms) {
  return rooms.filter(r => !r.has_password && !r.is_private);
}

// Lobi'ye filtrelenmiş oda listesi gönder
async function broadcastLobbyRooms(io) {
  const rooms = await roomsQueries.listActive(50);
  io.to('lobby').emit('lobby:rooms', { rooms: filterPublicRooms(rooms) });
}

function roomHandler(io, socket) {
  // Odaya tekrar katıl (reconnection / sayfa yenileme sonrası)
  socket.on('room:rejoin', async ({ roomId }) => {
    if (!roomId || !Number.isInteger(roomId) || roomId <= 0) return;

    try {
      // Bekleyen disconnect varsa iptal et (refresh sonrası geri döndü)
      const pending = clearPendingDisconnect(socket.user.id);

      // Oyuncu hâlâ bu odada mı kontrol et
      const player = await roomsQueries.getPlayerByRoomAndUser(roomId, socket.user.id);
      if (!player) return;

      const room = await roomsQueries.findById(roomId);
      if (!room || !['waiting', 'playing'].includes(room.status)) return;

      const roomKey = `room:${roomId}`;
      socket.join(roomKey);
      socket.currentRoom = roomId;

      // Bekleyen disconnect iptal edildiyse diğer oyunculara bildir
      if (pending && pending.roomId === roomId) {
        io.to(roomKey).emit('room:player_reconnected', {
          userId: socket.user.id,
          username: socket.user.displayName || socket.user.username,
        });
        logger.info('Player reconnected (grace period cancelled)', {
          userId: socket.user.id,
          roomId,
        });
      } else {
        logger.debug('Socket rejoined room', {
          socketId: socket.id,
          userId: socket.user.id,
          roomId,
        });
      }
    } catch (err) {
      logger.error('Room rejoin error', { error: err.message, userId: socket.user.id });
    }
  });

  // Odaya katıl (Socket room)
  socket.on('room:join', async ({ code, password }) => {
    try {
      const result = await roomService.joinRoom({
        userId: socket.user.id,
        code,
        password,
      });

      const roomKey = `room:${result.room.id}`;
      socket.join(roomKey);
      socket.currentRoom = result.room.id;

      // Oda bilgilerini gönder
      const roomData = await roomService.getRoom(result.room.id);
      socket.emit('room:joined', { room: roomData });

      // Yeni oyuncu ise diğerlerine ve lobiye bildir
      if (!result.alreadyJoined) {
        socket.to(roomKey).emit('room:player_joined', {
          userId: socket.user.id,
          username: socket.user.displayName || socket.user.username,
          players: roomData.players,
        });

        // Lobi'ye oda güncelle
        await broadcastLobbyRooms(io);
      }
    } catch (err) {
      socket.emit('room:error', { message: err.message });
    }
  });

  // Odadan ayrıl
  socket.on('room:leave', async () => {
    if (!socket.currentRoom) return;

    try {
      const roomId = socket.currentRoom;
      const roomKey = `room:${roomId}`;

      const result = await roomService.leaveRoom({ userId: socket.user.id, roomId });

      // Oda terk edildiyse oyun zamanlayıcılarını temizle
      if (result.abandoned) {
        clearRoomTimer(roomId);
        clearVotingTimer(roomId);
      }

      socket.leave(roomKey);
      socket.currentRoom = null;

      // Diğer oyunculara bildir
      const players = await roomsQueries.getPlayers(roomId);
      io.to(roomKey).emit('room:player_left', {
        userId: socket.user.id,
        username: socket.user.displayName || socket.user.username,
        players,
      });

      // Sahiplik devredildiyse oda bilgisini güncelle
      if (result.newOwnerId) {
        const updatedRoom = await roomService.getRoom(roomId);
        io.to(roomKey).emit('room:owner_changed', {
          newOwnerId: result.newOwnerId,
          room: updatedRoom,
        });
      }

      socket.emit('room:left');

      // Lobi güncelle
      await broadcastLobbyRooms(io);
    } catch (err) {
      socket.emit('room:error', { message: err.message });
    }
  });

  // Hazır ol/değil
  socket.on('room:ready', async ({ ready }) => {
    if (!socket.currentRoom) return;

    try {
      const result = await roomService.setReady(socket.currentRoom, socket.user.id, ready);
      const roomKey = `room:${socket.currentRoom}`;

      io.to(roomKey).emit('room:ready_update', {
        userId: socket.user.id,
        ready,
        players: result.players,
        allReady: result.allReady,
      });
    } catch (err) {
      socket.emit('room:error', { message: err.message });
    }
  });

  // Oda ayarlarını güncelle (sadece owner)
  socket.on('room:update_settings', async (settings) => {
    if (!socket.currentRoom) return;

    try {
      const updated = await roomService.updateSettings(socket.currentRoom, socket.user.id, settings);
      const roomKey = `room:${socket.currentRoom}`;
      io.to(roomKey).emit('room:settings_updated', { settings: updated });

      // Lobi güncelle
      await broadcastLobbyRooms(io);
    } catch (err) {
      socket.emit('room:error', { message: err.message });
    }
  });

  // Kategorileri güncelle (sıralama)
  socket.on('room:update_categories', async ({ categoryIds }) => {
    if (!socket.currentRoom) return;

    try {
      const categories = await roomService.updateCategories(socket.currentRoom, socket.user.id, categoryIds);
      const roomKey = `room:${socket.currentRoom}`;
      io.to(roomKey).emit('room:categories_updated', { categories });

      // Lobi güncelle
      await broadcastLobbyRooms(io);
    } catch (err) {
      socket.emit('room:error', { message: err.message });
    }
  });

  // Yeni kategori ekle
  socket.on('room:add_category', async ({ name }) => {
    if (!socket.currentRoom) return;

    try {
      const categories = await roomService.addCategory(socket.currentRoom, socket.user.id, name);
      const roomKey = `room:${socket.currentRoom}`;
      io.to(roomKey).emit('room:categories_updated', { categories });

      // Lobi güncelle
      await broadcastLobbyRooms(io);
    } catch (err) {
      socket.emit('room:error', { message: err.message });
    }
  });

  // Kategori kaldır
  socket.on('room:remove_category', async ({ categoryId }) => {
    if (!socket.currentRoom) return;

    try {
      const categories = await roomService.removeCategory(socket.currentRoom, socket.user.id, categoryId);
      const roomKey = `room:${socket.currentRoom}`;
      io.to(roomKey).emit('room:categories_updated', { categories });

      // Lobi güncelle
      await broadcastLobbyRooms(io);
    } catch (err) {
      socket.emit('room:error', { message: err.message });
    }
  });

  // Harfleri güncelle
  socket.on('room:update_letters', async ({ letters }) => {
    if (!socket.currentRoom) return;

    try {
      const updated = await roomService.updateLetters(socket.currentRoom, socket.user.id, letters);
      const roomKey = `room:${socket.currentRoom}`;
      io.to(roomKey).emit('room:letters_updated', { letters: updated });

      // Lobi güncelle
      await broadcastLobbyRooms(io);
    } catch (err) {
      socket.emit('room:error', { message: err.message });
    }
  });

  // Sahipliği devret
  socket.on('room:transfer_ownership', async ({ targetUserId }) => {
    if (!socket.currentRoom) return;

    try {
      await roomService.transferOwnership({
        roomId: socket.currentRoom,
        ownerId: socket.user.id,
        targetUserId,
      });

      const roomKey = `room:${socket.currentRoom}`;
      const updatedRoom = await roomService.getRoom(socket.currentRoom);
      io.to(roomKey).emit('room:owner_changed', {
        newOwnerId: targetUserId,
        room: updatedRoom,
      });

      // Lobi güncelle
      await broadcastLobbyRooms(io);
    } catch (err) {
      socket.emit('room:error', { message: err.message });
    }
  });

  // Oyun sonrasında odayı sıfırla (yeni oyun için)
  socket.on('room:reset_for_new_game', async () => {
    if (!socket.currentRoom) return;

    try {
      const room = await roomsQueries.findById(socket.currentRoom);
      if (!room) return;
      if (room.status !== 'finished') return;

      // Odayı waiting durumuna al, current_round sıfırla
      await roomsQueries.updateStatus(socket.currentRoom, 'waiting');
      const { query: dbQuery } = require('../../config/database');
      await dbQuery(
        'UPDATE rooms SET current_round = 0, started_at = NULL, finished_at = NULL, last_activity = now() WHERE id = $1',
        [socket.currentRoom]
      );

      // Oyuncu skorlarını sıfırla ve hazır durumunu kaldır
      await dbQuery(
        'UPDATE room_players SET total_score = 0, is_ready = FALSE WHERE room_id = $1',
        [socket.currentRoom]
      );

      // Eski oyun verilerini temizle (turlar → cevaplar → oylar → görseller)
      await dbQuery(
        'DELETE FROM game_rounds WHERE room_id = $1',
        [socket.currentRoom]
      );

      const roomKey = `room:${socket.currentRoom}`;
      const updatedRoom = await roomService.getRoom(socket.currentRoom);
      io.to(roomKey).emit('room:reset', { room: updatedRoom });

      // Lobi güncelle
      await broadcastLobbyRooms(io);
    } catch (err) {
      socket.emit('room:error', { message: err.message });
    }
  });

  // Disconnect: grace period ile geciktirilmiş odadan çıkış
  socket.on('disconnect', async () => {
    if (!socket.currentRoom) return;

    const roomId = socket.currentRoom;
    const userId = socket.user.id;
    const roomKey = `room:${roomId}`;

    try {
      // Aynı kullanıcı için zaten bekleyen disconnect varsa yenisiyle değiştir
      clearPendingDisconnect(userId);

      const room = await roomsQueries.findById(roomId);
      if (!room || !['waiting', 'playing'].includes(room.status)) {
        // Oda aktif değilse direkt çıkar
        await roomService.leaveRoom({ userId, roomId });
        return;
      }

      // Grace period süresi belirle
      const gracePeriod = room.status === 'playing'
        ? DISCONNECT_GRACE_PLAYING
        : DISCONNECT_GRACE_WAITING;

      // Diğer oyunculara geçici kopma bildirimi gönder
      io.to(roomKey).emit('room:player_disconnected', {
        userId,
        username: socket.user.displayName || socket.user.username,
        gracePeriod,
      });

      logger.info('Player disconnected, starting grace period', {
        userId,
        roomId,
        gracePeriodMs: gracePeriod,
      });

      // Grace period zamanlayıcısı başlat
      const timerId = setTimeout(async () => {
        pendingDisconnects.delete(userId);

        try {
          // Grace period doldu, oyuncuyu gerçekten çıkar
          const result = await roomService.leaveRoom({ userId, roomId });

          if (result.abandoned) {
            clearRoomTimer(roomId);
            clearVotingTimer(roomId);
          }

          const players = await roomsQueries.getPlayers(roomId);
          io.to(roomKey).emit('room:player_left', {
            userId,
            username: socket.user.displayName || socket.user.username,
            players,
          });

          if (result.newOwnerId) {
            const updatedRoom = await roomService.getRoom(roomId);
            io.to(roomKey).emit('room:owner_changed', {
              newOwnerId: result.newOwnerId,
              room: updatedRoom,
            });
          }

          await broadcastLobbyRooms(io);

          logger.info('Player removed after grace period expired', {
            userId,
            roomId,
          });
        } catch (err) {
          logger.error('Error removing player after grace period', {
            error: err.message,
            userId,
            roomId,
          });
        }
      }, gracePeriod);

      pendingDisconnects.set(userId, { timerId, roomId, socketId: socket.id });
    } catch (err) {
      logger.error('Error handling disconnect from room', { error: err.message });
    }
  });
}

function clearAllPendingDisconnects() {
  for (const [userId, entry] of pendingDisconnects) {
    clearTimeout(entry.timerId);
  }
  pendingDisconnects.clear();
}

module.exports = { roomHandler, clearPendingDisconnect, clearAllPendingDisconnects, pendingDisconnects, setGracePeriods };
