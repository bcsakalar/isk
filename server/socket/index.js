const { Server } = require('socket.io');
const socketAuth = require('./middleware/socketAuth');
const socketRateLimit = require('./middleware/socketRateLimit');
const { lobbyHandler } = require('./handlers/lobby.handler');
const { roomHandler, clearPendingDisconnect } = require('./handlers/room.handler');
const { gameHandler } = require('./handlers/game.handler');
const { chatHandler } = require('./handlers/chat.handler');
const { adminHandler } = require('./handlers/admin.handler');
const roomsQueries = require('../db/queries/rooms.queries');
const logger = require('../utils/logger');
const env = require('../config/env');

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: env.cors.origin,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 3e6, // 3MB max mesaj boyutu (base64 görsel desteği — 2.8MB limit + overhead)
  });

  // Middleware
  io.use(socketAuth);
  io.use((socket, next) => {
    socketRateLimit(socket, next);
  });

  io.on('connection', async (socket) => {
    logger.info('Socket connected', {
      socketId: socket.id,
      userId: socket.user.id,
      username: socket.user.username,
    });

    // Reconnection: kullanıcının aktif odası varsa otomatik rejoin
    try {
      // Bekleyen disconnect varsa iptal et (yeni socket bağlandı = kullanıcı geri döndü)
      clearPendingDisconnect(socket.user.id);

      const activeRoomId = await roomsQueries.getActiveRoomForUser(socket.user.id);
      if (activeRoomId) {
        const roomKey = `room:${activeRoomId}`;
        socket.join(roomKey);
        socket.currentRoom = activeRoomId;
        logger.debug('Socket auto-rejoined room', {
          socketId: socket.id,
          userId: socket.user.id,
          roomId: activeRoomId,
        });
      }
    } catch (err) {
      logger.error('Auto-rejoin error', { error: err.message, userId: socket.user.id });
    }

    // Handler'ları bağla
    lobbyHandler(io, socket);
    roomHandler(io, socket);
    gameHandler(io, socket);
    chatHandler(io, socket);
    adminHandler(io, socket);

    socket.on('disconnect', (reason) => {
      logger.debug('Socket disconnected', {
        socketId: socket.id,
        userId: socket.user.id,
        reason,
      });
    });

    socket.on('error', (err) => {
      logger.error('Socket error', {
        socketId: socket.id,
        userId: socket.user?.id,
        error: err.message,
      });
    });
  });

  return io;
}

module.exports = initSocket;
