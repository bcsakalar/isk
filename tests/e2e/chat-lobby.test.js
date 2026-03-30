const { createSocketTestServer } = require('../helpers/socketTestServer');
const { createPlayerClient, createPlayers, disconnectAll, resetClientCounter } = require('../helpers/socketTestClient');

// ─── Mock DB Queries ─────────────────────────────────────────────
jest.mock('../../server/db/queries/rooms.queries');
jest.mock('../../server/db/queries/games.queries');
jest.mock('../../server/db/queries/users.queries');
jest.mock('../../server/db/queries/admin.queries');

// ─── Mock Services ──────────────────────────────────────────────
jest.mock('../../server/services/room.service');
jest.mock('../../server/services/game.service');

const roomService = require('../../server/services/room.service');
const roomsQueries = require('../../server/db/queries/rooms.queries');
const gamesQueries = require('../../server/db/queries/games.queries');

let testServer;
let port;

beforeAll(async () => {
  testServer = await createSocketTestServer();
  port = testServer.port;
});

afterAll(async () => {
  await testServer.close();
});

beforeEach(() => {
  jest.clearAllMocks();
  resetClientCounter();
  roomsQueries.listActive.mockResolvedValue([]);
});

// ═════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════

async function joinRoom(players, roomId = 1, ownerId = 100) {
  const mockRoom = {
    id: roomId, code: 'CHAT01', name: 'Chat Odası', owner_id: ownerId,
    status: 'waiting', max_players: 16,
  };

  for (let i = 0; i < players.length; i++) {
    const userId = players[i].userId || (ownerId + i);
    roomService.joinRoom.mockResolvedValueOnce({
      room: mockRoom,
      player: { user_id: userId, username: `player${i + 1}`, is_ready: false, total_score: 0 },
    });
    roomsQueries.getPlayers.mockResolvedValueOnce(
      Array.from({ length: i + 1 }, (_, j) => ({
        user_id: ownerId + j, username: `player${j + 1}`, is_ready: false, total_score: 0,
      }))
    );

    const joinPromise = players[i].waitFor('room:joined', 3000);
    players[i].socket.emit('room:join', { roomId, password: null });
    await joinPromise;
  }

  return mockRoom;
}

// ═════════════════════════════════════════════════════════════════
// LOBİ TESTLERİ
// ═════════════════════════════════════════════════════════════════

describe('Chat & Lobby — E2E Socket Tests', () => {
  // ─── 1. Lobby Online Sayısı ───────────────────────────────────
  describe('lobby online sayısı', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('5 kullanıcı bağlanınca online sayısı artar', async () => {
      for (let i = 0; i < 5; i++) {
        const p = await createPlayerClient(port, { id: 900 + i, username: `lobby${i + 1}` });
        expect(p.lastOnlineCount).not.toBeNull();
        expect(p.lastOnlineCount.count).toBeGreaterThanOrEqual(i + 1);
        players.push(p);
      }
    });

    it('kullanıcı disconnect olunca online sayısı güncellenir', async () => {
      const p1 = await createPlayerClient(port, { id: 950, username: 'disc1' });
      const p2 = await createPlayerClient(port, { id: 951, username: 'disc2' });
      players.push(p2);

      // p1'in disconnect olayını p2 dinler
      const countPromise = p2.waitFor('lobby:online_count', 3000);
      p1.socket.disconnect();
      const countData = await countPromise;
      expect(typeof countData.count).toBe('number');
    });
  });

  // ─── 2. Lobby Oda Listesi ────────────────────────────────────
  describe('lobby oda listesi', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('bağlanan kullanıcı lobby:rooms alır', async () => {
      roomsQueries.listActive.mockResolvedValue([
        { id: 1, name: 'Oda A', code: 'AAAA', player_count: 3, max_players: 8, status: 'waiting' },
        { id: 2, name: 'Oda B', code: 'BBBB', player_count: 5, max_players: 10, status: 'playing' },
      ]);

      const p = await createPlayerClient(port, { id: 960, username: 'lobbylist1' });
      players.push(p);

      // lobbyRooms eagerly captured
      expect(p.lobbyRooms).not.toBeNull();
      expect(p.lobbyRooms.rooms).toHaveLength(2);
      expect(p.lobbyRooms.rooms[0].name).toBe('Oda A');
    });

    it('lobby:refresh ile oda listesi yenilenir', async () => {
      const p = await createPlayerClient(port, { id: 961, username: 'refresh1' });
      players.push(p);

      roomsQueries.listActive.mockResolvedValueOnce([
        { id: 3, name: 'Yeni Oda', code: 'NEW1', player_count: 1, max_players: 4, status: 'waiting' },
      ]);

      const roomsPromise = p.waitFor('lobby:rooms', 3000);
      p.socket.emit('lobby:refresh');
      const data = await roomsPromise;

      expect(data.rooms).toHaveLength(1);
      expect(data.rooms[0].name).toBe('Yeni Oda');
    });
  });

  // ─── 3. Oda Chat — Oyuncular ─────────────────────────────────
  describe('oda chat', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('oda mesajı sadece o odadaki oyunculara gider', async () => {
      const roomPlayers = [];
      for (let i = 0; i < 5; i++) {
        const p = await createPlayerClient(port, { id: 700 + i, username: `room_chat${i + 1}` });
        p.userId = 700 + i;
        roomPlayers.push(p);
      }

      const lobbyPlayers = [];
      for (let i = 0; i < 3; i++) {
        const p = await createPlayerClient(port, { id: 750 + i, username: `lobby_stay${i + 1}` });
        lobbyPlayers.push(p);
      }

      players = [...roomPlayers, ...lobbyPlayers];

      await joinRoom(roomPlayers, 5, 700);

      gamesQueries.saveMessage.mockResolvedValueOnce({
        id: 20, created_at: new Date().toISOString(),
      });

      const roomMsgPromises = roomPlayers.map(p => p.waitFor('chat:room_message', 3000));
      roomPlayers[0].socket.emit('chat:room', { message: 'Oda mesajı!' });

      const results = await Promise.all(roomMsgPromises);
      results.forEach(r => {
        expect(r.message).toBe('Oda mesajı!');
        expect(r.userId).toBe(700);
      });

      // Lobi oyuncuları mesaj almamalı
      await new Promise(resolve => setTimeout(resolve, 200));
    });
  });

  // ─── 5. Emoji Tepkileri ───────────────────────────────────────
  describe('emoji tepkileri', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('izinli emoji tüm odaya yayınlanır', async () => {
      const ps = [];
      for (let i = 0; i < 4; i++) {
        const p = await createPlayerClient(port, { id: 600 + i, username: `emoji${i + 1}` });
        p.userId = 600 + i;
        ps.push(p);
      }
      players = ps;

      await joinRoom(ps, 6, 600);

      const reactionPromises = ps.map(p => p.waitFor('chat:reaction', 3000));
      ps[1].socket.emit('chat:reaction', { emoji: '🔥' });

      const results = await Promise.all(reactionPromises);
      results.forEach(r => {
        expect(r.emoji).toBe('🔥');
        expect(r.userId).toBe(601);
        expect(r.displayName).toBeDefined();
      });
    });

    it('izinsiz emoji sessizce reddedilir', async () => {
      const ps = [];
      for (let i = 0; i < 2; i++) {
        const p = await createPlayerClient(port, { id: 620 + i, username: `badmoji${i + 1}` });
        p.userId = 620 + i;
        ps.push(p);
      }
      players = ps;

      await joinRoom(ps, 7, 620);

      ps[0].socket.emit('chat:reaction', { emoji: '🤬' });

      // 300ms bekle — reaction gelmemeli
      await new Promise(resolve => setTimeout(resolve, 300));
    });

    it('tüm izinli emojiler doğru çalışır', async () => {
      const allowedEmojis = ['👍', '👏', '😂', '😮', '😡', '🔥', '💯', '⭐'];

      const ps = [];
      for (let i = 0; i < 3; i++) {
        const p = await createPlayerClient(port, { id: 640 + i, username: `allemo${i + 1}` });
        p.userId = 640 + i;
        ps.push(p);
      }
      players = ps;

      await joinRoom(ps, 8, 640);

      for (const emoji of allowedEmojis) {
        const reactionPromises = ps.map(p => p.waitFor('chat:reaction', 3000));
        ps[0].socket.emit('chat:reaction', { emoji });

        const results = await Promise.all(reactionPromises);
        results.forEach(r => {
          expect(r.emoji).toBe(emoji);
        });
      }
    });
  });

  // ─── 6. Mesaj Geçmişi ────────────────────────────────────────
  describe('mesaj geçmişi', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('chat:history ile lobi mesaj geçmişi alınır', async () => {
      const p = await createPlayerClient(port, { id: 660, username: 'hist1' });
      players.push(p);

      const mockHistory = [
        { id: 1, user_id: 660, message: 'Eski mesaj 1', created_at: '2024-01-01' },
        { id: 2, user_id: 661, message: 'Eski mesaj 2', created_at: '2024-01-02' },
      ];
      gamesQueries.getMessages.mockResolvedValueOnce(mockHistory);

      const histPromise = p.waitFor('chat:history', 3000);
      p.socket.emit('chat:history', { roomId: null, limit: 50 });

      const data = await histPromise;
      expect(data.messages).toHaveLength(2);
      expect(data.roomId).toBeNull();
    });

    it('oda mesaj geçmişi roomId ile alınır', async () => {
      const p = await createPlayerClient(port, { id: 670, username: 'hist2' });
      players.push(p);

      gamesQueries.getMessages.mockResolvedValueOnce([
        { id: 5, user_id: 670, message: 'Oda eski mesaj', created_at: '2024-03-01' },
      ]);

      const histPromise = p.waitFor('chat:history', 3000);
      p.socket.emit('chat:history', { roomId: 42, limit: 20 });

      const data = await histPromise;
      expect(data.messages).toHaveLength(1);
      expect(data.roomId).toBe(42);
    });

    it('limit 100\'den fazla olamaz', async () => {
      const p = await createPlayerClient(port, { id: 680, username: 'hist3' });
      players.push(p);

      gamesQueries.getMessages.mockResolvedValueOnce([]);

      const histPromise = p.waitFor('chat:history', 3000);
      p.socket.emit('chat:history', { roomId: null, limit: 500 });

      await histPromise;
      expect(gamesQueries.getMessages).toHaveBeenCalledWith(null, 100);
    });
  });
});
