// Socket.IO Client Manager
const SocketClient = (() => {
  let socket = null;
  const eventHandlers = new Map();

  function connect() {
    const token = Store.get('token');
    if (!token) return;
    if (socket && socket.connected) return;

    socket = io({ auth: { token }, transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);

      // Reconnect: aktif odaya tekrar katıl
      const currentRoom = Store.get('currentRoom');
      const roomId = currentRoom?.id || Store.getPersistedRoomId();
      if (roomId) {
        socket.emit('room:rejoin', { roomId });
      }

      emit('_connected');
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      emit('_disconnected', reason);
      if (reason === 'io server disconnect' || reason === 'transport close') {
        Toast.error('Sunucu bağlantısı koptu');
      }
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      if (err.message.includes('token')) {
        Store.clearAuth();
        Router.navigate('/auth');
        Toast.error('Oturum süresi doldu, tekrar giriş yapın');
      } else if (err.message.includes('Rate')) {
        Toast.error('Çok fazla istek gönderdiniz, lütfen bekleyin');
      }
    });

    // Lobby events
    socket.on('lobby:online_count', (d) => emit('lobby:online_count', d));
    socket.on('lobby:rooms', (d) => emit('lobby:rooms', d));

    // Room events
    socket.on('room:joined', (d) => emit('room:joined', d));
    socket.on('room:player_joined', (d) => emit('room:player_joined', d));
    socket.on('room:player_left', (d) => emit('room:player_left', d));
    socket.on('room:player_disconnected', (d) => emit('room:player_disconnected', d));
    socket.on('room:player_reconnected', (d) => emit('room:player_reconnected', d));
    socket.on('room:ready_update', (d) => emit('room:ready_update', d));
    socket.on('room:left', (d) => emit('room:left', d));
    socket.on('room:error', (d) => emit('room:error', d));
    socket.on('room:kicked', (d) => emit('room:kicked', d));
    socket.on('room:closed', (d) => emit('room:closed', d));
    socket.on('room:player_kicked', (d) => emit('room:player_kicked', d));
    socket.on('room:owner_changed', (d) => emit('room:owner_changed', d));

    // Game events
    socket.on('game:started', (d) => emit('game:started', d));
    socket.on('game:new_round', (d) => emit('game:new_round', d));
    socket.on('game:timer', (d) => emit('game:timer', d));
    socket.on('game:time_up', (d) => emit('game:time_up', d));
    socket.on('game:player_submitted', (d) => emit('game:player_submitted', d));
    socket.on('game:answers_submitted', (d) => emit('game:answers_submitted', d));
    socket.on('game:round_ended', (d) => emit('game:round_ended', d));
    socket.on('game:finished', (d) => emit('game:finished', d));
    socket.on('game:error', (d) => emit('game:error', d));

    // Voting events
    socket.on('game:voting_started', (d) => emit('game:voting_started', d));
    socket.on('game:voting_timer', (d) => emit('game:voting_timer', d));
    socket.on('game:voting_ended', (d) => emit('game:voting_ended', d));
    socket.on('game:vote_update', (d) => emit('game:vote_update', d));
    socket.on('game:image_uploaded', (d) => emit('game:image_uploaded', d));
    socket.on('game:answer_revealed', (d) => emit('game:answer_revealed', d));

    // Room settings events
    socket.on('room:settings_updated', (d) => emit('room:settings_updated', d));
    socket.on('room:categories_updated', (d) => emit('room:categories_updated', d));
    socket.on('room:letters_updated', (d) => emit('room:letters_updated', d));

    // Chat events
    socket.on('chat:room_message', (d) => emit('chat:room_message', d));
    socket.on('chat:reaction', (d) => emit('chat:reaction', d));
    socket.on('chat:history', (d) => emit('chat:history', d));

    // Announcements
    socket.on('announcement', (d) => emit('announcement', d));
  }

  function disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  }

  function send(event, data) {
    if (socket && socket.connected) {
      socket.emit(event, data);
    }
  }

  // Local event bus
  function on(event, callback) {
    if (!eventHandlers.has(event)) eventHandlers.set(event, new Set());
    eventHandlers.get(event).add(callback);
    return () => eventHandlers.get(event).delete(callback);
  }

  function off(event, callback) {
    if (eventHandlers.has(event)) {
      eventHandlers.get(event).delete(callback);
    }
  }

  function emit(event, data) {
    const handlers = eventHandlers.get(event);
    if (handlers) {
      for (const h of handlers) h(data);
    }
  }

  function isConnected() {
    return !!(socket && socket.connected && socket.id);
  }

  return { connect, disconnect, send, on, off, isConnected };
})();
