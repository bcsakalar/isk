// Global State Store — Reactive Vanilla JS State Management
const Store = (() => {
  const state = {
    user: null,
    token: null,
    refreshToken: null,
    currentRoom: null,
    currentRound: null,
    players: [],
    messages: [],
    onlineCount: 0,
    rooms: [],
    scores: [],
    gameState: 'idle', // idle | waiting | playing | voting | scoring | finished
    votingPhase: false,
    currentCategory: 0,
    votes: {},
    detailedAnswers: [],
    currentRoundId: null,
  };

  const listeners = new Map();

  function get(key) {
    return state[key];
  }

  function set(key, value) {
    const old = state[key];
    state[key] = value;

    // currentRoom değiştiğinde roomId'yi sessionStorage'a persist et
    if (key === 'currentRoom') {
      if (value && value.id) {
        sessionStorage.setItem('isk_roomId', value.id);
      } else {
        sessionStorage.removeItem('isk_roomId');
      }
    }

    notify(key, value, old);
  }

  function update(key, fn) {
    const old = state[key];
    state[key] = fn(old);
    notify(key, state[key], old);
  }

  function on(key, callback) {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(callback);
    return () => listeners.get(key).delete(callback);
  }

  function notify(key, newVal, oldVal) {
    const set = listeners.get(key);
    if (set) {
      for (const cb of set) cb(newVal, oldVal);
    }
  }

  // Token persistence
  function loadFromStorage() {
    try {
      // Önce localStorage (kayıtlı kullanıcı), sonra sessionStorage (misafir)
      let token = localStorage.getItem('isk_token');
      let refreshToken = localStorage.getItem('isk_refresh_token');
      let user = localStorage.getItem('isk_user');

      if (!token) {
        token = sessionStorage.getItem('isk_token');
        user = sessionStorage.getItem('isk_user');
        refreshToken = null;
      }

      if (token) state.token = token;
      if (refreshToken) state.refreshToken = refreshToken;
      if (user) state.user = JSON.parse(user);
    } catch (e) { /* ignore */ }
  }

  function saveAuth(user, token, refreshToken) {
    const isGuest = user && user.role === 'guest';
    set('user', user);
    set('token', token);
    set('refreshToken', refreshToken);
    if (isGuest) {
      // Misafirler için sessionStorage kullan (sekme kapanınca silinsin)
      sessionStorage.setItem('isk_token', token);
      sessionStorage.setItem('isk_user', JSON.stringify(user));
    } else {
      localStorage.setItem('isk_token', token);
      if (refreshToken) localStorage.setItem('isk_refresh_token', refreshToken);
      localStorage.setItem('isk_user', JSON.stringify(user));
    }
  }

  function clearAuth() {
    set('user', null);
    set('token', null);
    set('refreshToken', null);
    localStorage.removeItem('isk_token');
    localStorage.removeItem('isk_refresh_token');
    localStorage.removeItem('isk_user');
    sessionStorage.removeItem('isk_token');
    sessionStorage.removeItem('isk_user');
    sessionStorage.removeItem('isk_roomId');
  }

  function isGuest() {
    const user = state.user;
    return user && user.role === 'guest';
  }

  function getPersistedRoomId() {
    const id = sessionStorage.getItem('isk_roomId');
    return id ? parseInt(id, 10) : null;
  }

  loadFromStorage();

  return { get, set, update, on, saveAuth, clearAuth, isGuest, getPersistedRoomId };
})();
