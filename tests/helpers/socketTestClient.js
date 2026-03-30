const { io: Client } = require('socket.io-client');
const jwt = require('jsonwebtoken');

const TEST_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing-only';
let clientCounter = 0;

/**
 * E2E test için bir oyuncu client'ı oluşturur.
 * JWT token üretir, socket.io-client ile bağlanır, yardımcı metotlar sağlar.
 *
 * @param {number} port - Sunucu portu
 * @param {object} userOverrides - Kullanıcı alanlarını override et
 * @returns {Promise<{socket: Socket, user: object, token: string, waitFor: Function, emitAndWait: Function, disconnect: Function}>}
 */
async function createPlayerClient(port, userOverrides = {}) {
  clientCounter++;
  const user = {
    id: userOverrides.id || clientCounter,
    username: userOverrides.username || `player_${clientCounter}`,
    displayName: userOverrides.displayName || `Player ${clientCounter}`,
    role: userOverrides.role || 'player',
    ...userOverrides,
  };

  const token = jwt.sign(user, TEST_SECRET, { expiresIn: '1h' });

  const socket = Client(`http://localhost:${port}`, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });

  // Lobby handler fires events on connect — store eagerly BEFORE connect resolves
  let _lastOnlineCount = null;
  let _lobbyRooms = null;
  socket.on('lobby:online_count', (data) => { _lastOnlineCount = data; });
  socket.on('lobby:rooms', (data) => { _lobbyRooms = data; });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Socket connection timeout')), 5000);
    socket.on('connect', () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  // Allow lobby handler to fire (async query for rooms)
  await new Promise(r => setTimeout(r, 100));

  /**
   * Belirli bir event'i bekle (timeout ile)
   * @param {string} event - Beklenecek event adı
   * @param {number} timeout - Timeout ms (varsayılan 5000)
   * @returns {Promise<any>} Event data
   */
  function waitFor(event, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off(event, handler);
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);
      const handler = (data) => {
        clearTimeout(timer);
        resolve(data);
      };
      socket.once(event, handler);
    });
  }

  /**
   * Event emit et ve belirli bir response event'i bekle
   * @param {string} emitEvent - Gönderilecek event
   * @param {any} data - Gönderilecek data
   * @param {string} responseEvent - Beklenecek response event
   * @param {number} timeout - Timeout ms
   * @returns {Promise<any>} Response data
   */
  function emitAndWait(emitEvent, data, responseEvent, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off(responseEvent, handler);
        reject(new Error(`Timeout: emitted '${emitEvent}', waiting for '${responseEvent}'`));
      }, timeout);
      const handler = (responseData) => {
        clearTimeout(timer);
        resolve(responseData);
      };
      socket.once(responseEvent, handler);
      socket.emit(emitEvent, data);
    });
  }

  /**
   * Birden fazla event'i aynı anda bekle
   * @param {string[]} events - Beklenecek event adları
   * @param {number} timeout - Timeout ms
   * @returns {Promise<object>} { eventName: data, ... }
   */
  function waitForAll(events, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const results = {};
      let count = 0;
      const timer = setTimeout(() => {
        events.forEach(e => socket.off(e));
        reject(new Error(`Timeout waiting for events: ${events.filter(e => !results[e]).join(', ')}`));
      }, timeout);

      events.forEach((event) => {
        socket.once(event, (data) => {
          results[event] = data;
          count++;
          if (count === events.length) {
            clearTimeout(timer);
            resolve(results);
          }
        });
      });
    });
  }

  /**
   * Belirli bir event'i N kez bekle (toplayıcı)
   * @param {string} event - Event adı
   * @param {number} n - Kaç kez bekleneceği
   * @param {number} timeout - Timeout ms
   * @returns {Promise<any[]>} Toplanan event data'ları
   */
  function collectEvents(event, n, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const collected = [];
      const timer = setTimeout(() => {
        socket.off(event, handler);
        reject(new Error(`Timeout collecting ${event}: got ${collected.length}/${n}`));
      }, timeout);
      const handler = (data) => {
        collected.push(data);
        if (collected.length >= n) {
          clearTimeout(timer);
          socket.off(event, handler);
          resolve(collected);
        }
      };
      socket.on(event, handler);
    });
  }

  function disconnect() {
    socket.disconnect();
  }

  return {
    socket,
    user,
    token,
    waitFor,
    emitAndWait,
    waitForAll,
    collectEvents,
    disconnect,
    get lastOnlineCount() { return _lastOnlineCount; },
    get lobbyRooms() { return _lobbyRooms; },
  };
}

/**
 * N adet oyuncu oluşturup bağla
 * @param {number} port - Sunucu portu
 * @param {number} count - Oyuncu sayısı
 * @param {Function} overrideFn - (index) => userOverrides objesi döndüren fonksiyon
 * @returns {Promise<Array>} Oyuncu client dizisi
 */
async function createPlayers(port, count, overrideFn) {
  const players = [];
  for (let i = 0; i < count; i++) {
    const overrides = overrideFn ? overrideFn(i) : {};
    const player = await createPlayerClient(port, overrides);
    players.push(player);
  }
  return players;
}

/**
 * Tüm oyuncuları temizle
 * @param {Array} players - createPlayerClient dizisi
 */
function disconnectAll(players) {
  players.forEach(p => p.disconnect());
}

/**
 * Counter'ı sıfırla (test izolasyonu için)
 */
function resetClientCounter() {
  clientCounter = 0;
}

module.exports = {
  createPlayerClient,
  createPlayers,
  disconnectAll,
  resetClientCounter,
};
