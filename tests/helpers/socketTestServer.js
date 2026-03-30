const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const socketAuth = require('../../server/socket/middleware/socketAuth');
const { lobbyHandler, resetOnlineUsers } = require('../../server/socket/handlers/lobby.handler');
const { roomHandler, clearPendingDisconnect, clearAllPendingDisconnects } = require('../../server/socket/handlers/room.handler');
const { gameHandler, clearAllTimers } = require('../../server/socket/handlers/game.handler');
const { chatHandler } = require('../../server/socket/handlers/chat.handler');
const { adminHandler } = require('../../server/socket/handlers/admin.handler');

/**
 * E2E socket testleri için gerçek HTTP + Socket.IO sunucu oluşturur.
 * Rate limit devre dışı bırakılır (test ortamında throttle olmasın).
 * Port: 0 → OS rastgele port atar.
 *
 * @returns {Promise<{server: http.Server, io: Server, port: number, close: Function}>}
 */
async function createSocketTestServer() {
  const app = express();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: '*' },
    pingTimeout: 5000,
    pingInterval: 3000,
    maxHttpBufferSize: 1e6,
  });

  // Auth middleware (gerçek JWT doğrulama)
  io.use(socketAuth);

  // Rate limit DEVRE DIŞI — test ortamında throttle olmasın

  io.on('connection', (socket) => {
    lobbyHandler(io, socket);
    roomHandler(io, socket);
    gameHandler(io, socket);
    chatHandler(io, socket);
    adminHandler(io, socket);
  });

  await new Promise((resolve) => {
    server.listen(0, resolve);
  });

  const port = server.address().port;

  return {
    server,
    io,
    port,
    close: () => new Promise((resolve) => {
      clearAllTimers();
      clearAllPendingDisconnects();
      resetOnlineUsers();
      io.disconnectSockets(true);
      server.close(resolve);
    }),
  };
}

module.exports = { createSocketTestServer };
