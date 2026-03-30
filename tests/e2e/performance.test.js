const { createSocketTestServer } = require('../helpers/socketTestServer');
const { createPlayerClient, disconnectAll, resetClientCounter } = require('../helpers/socketTestClient');

// ─── Mock DB Queries ─────────────────────────────────────────────
jest.mock('../../server/db/queries/rooms.queries');
jest.mock('../../server/db/queries/games.queries');
jest.mock('../../server/db/queries/users.queries');
jest.mock('../../server/db/queries/admin.queries');

// ─── Mock Services ──────────────────────────────────────────────
jest.mock('../../server/services/room.service');
jest.mock('../../server/services/game.service');

const roomService = require('../../server/services/room.service');
const gameService = require('../../server/services/game.service');
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
// PERFORMANS TESTLERİ
// ═════════════════════════════════════════════════════════════════

describe('Performance — E2E Socket Tests', () => {
  // ─── 1. 15 Oyuncu Bağlantı Hızı ──────────────────────────────
  describe('bağlantı performansı', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('15 oyuncu 3 saniyeden kısa sürede bağlanır', async () => {
      const start = Date.now();

      for (let i = 0; i < 15; i++) {
        const p = await createPlayerClient(port, { id: 1000 + i, username: `perf${i + 1}` });
        players.push(p);
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(3000);
      expect(players).toHaveLength(15);
      players.forEach(p => expect(p.socket.connected).toBe(true));
    });
  });

  // ─── 2. Event Yayılım Latansı ────────────────────────────────
  describe('event yayılım latansı', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('15 kişilik odada mesaj yayılımı 200ms altında', async () => {
      const ps = [];
      for (let i = 0; i < 15; i++) {
        const p = await createPlayerClient(port, { id: 1100 + i, username: `lat${i + 1}` });
        p.userId = 1100 + i;
        ps.push(p);
      }
      players = ps;

      // Odaya katılım
      const mockRoom = {
        id: 50, code: 'PERF1', name: 'Performans Odası', owner_id: 1100,
        status: 'waiting', max_players: 16,
      };
      for (let i = 0; i < 15; i++) {
        roomService.joinRoom.mockResolvedValueOnce({
          room: mockRoom,
          player: { user_id: ps[i].userId, username: `lat${i + 1}`, is_ready: false, total_score: 0 },
        });
        roomsQueries.getPlayers.mockResolvedValueOnce(
          Array.from({ length: i + 1 }, (_, j) => ({
            user_id: 1100 + j, username: `lat${j + 1}`, is_ready: false, total_score: 0,
          }))
        );
        const joinPromise = ps[i].waitFor('room:joined', 3000);
        ps[i].socket.emit('room:join', { roomId: 50, password: null });
        await joinPromise;
      }

      // Mesaj yayılım testi
      gamesQueries.saveMessage.mockResolvedValueOnce({
        id: 1, created_at: new Date().toISOString(),
      });

      const start = Date.now();
      const msgPromises = ps.map(p => p.waitFor('chat:room_message', 3000));
      ps[0].socket.emit('chat:room', { message: 'Latans testi!' });

      await Promise.all(msgPromises);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(200);
    });
  });

  // ─── 3. Eş Zamanlı Oda Katılımı ──────────────────────────────
  describe('eş zamanlı oda katılımı', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('10 oyuncu eş zamanlı olarak odaya katılır', async () => {
      const ps = [];
      for (let i = 0; i < 10; i++) {
        const p = await createPlayerClient(port, { id: 1200 + i, username: `conc${i + 1}` });
        p.userId = 1200 + i;
        ps.push(p);
      }
      players = ps;

      const mockRoom = {
        id: 60, code: 'CONC1', name: 'Eş Zamanlı Oda', owner_id: 1200,
        status: 'waiting', max_players: 16,
      };

      // Her oyuncu için mock hazırla
      for (let i = 0; i < 10; i++) {
        roomService.joinRoom.mockResolvedValueOnce({
          room: mockRoom,
          player: { user_id: ps[i].userId, username: `conc${i + 1}`, is_ready: false, total_score: 0 },
        });
        roomsQueries.getPlayers.mockResolvedValueOnce(
          Array.from({ length: i + 1 }, (_, j) => ({
            user_id: 1200 + j, username: `conc${j + 1}`, is_ready: false, total_score: 0,
          }))
        );
      }

      const start = Date.now();
      // Tüm oyuncular eş zamanlı katılır
      const joinPromises = ps.map(p => {
        const joinP = p.waitFor('room:joined', 5000);
        p.socket.emit('room:join', { roomId: 60, password: null });
        return joinP;
      });

      await Promise.all(joinPromises);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(2000);
      expect(roomService.joinRoom).toHaveBeenCalledTimes(10);
    });
  });

  // ─── 4. Yoğun Oylama Trafiği ─────────────────────────────────
  describe('yoğun oylama trafiği', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('12 oyuncu 5 cevaba toplam 60 oy verir — hepsi işlenir', async () => {
      const ps = [];
      for (let i = 0; i < 12; i++) {
        const p = await createPlayerClient(port, { id: 1300 + i, username: `voter${i + 1}` });
        p.userId = 1300 + i;
        ps.push(p);
      }
      players = ps;

      // Odaya katılım
      const mockRoom = {
        id: 70, code: 'VOTE2', name: 'Yoğun Oy Odası', owner_id: 1300,
        status: 'voting', max_players: 16,
      };
      for (let i = 0; i < 12; i++) {
        roomService.joinRoom.mockResolvedValueOnce({
          room: mockRoom,
          player: { user_id: ps[i].userId, username: `voter${i + 1}`, is_ready: false, total_score: 0 },
        });
        roomsQueries.getPlayers.mockResolvedValueOnce(
          Array.from({ length: i + 1 }, (_, j) => ({
            user_id: 1300 + j, username: `voter${j + 1}`, is_ready: false, total_score: 0,
          }))
        );
        const joinPromise = ps[i].waitFor('room:joined', 3000);
        ps[i].socket.emit('room:join', { roomId: 70, password: null });
        await joinPromise;
      }

      // Her oyuncu 5 cevaba oy verir = 60 toplam oy
      // Tüm oyları mock'la ve bir oyuncudan tüm update'leri topla
      for (let i = 0; i < 60; i++) {
        gameService.submitVote.mockResolvedValueOnce(true);
        gamesQueries.getVoteCountsForAnswer.mockResolvedValueOnce({
          positive: '1', negative: '0',
        });
      }

      const collectPromise = ps[0].collectEvents('game:vote_update', 60, 10000);

      const start = Date.now();
      // Tüm oyları gönder
      for (let answIdx = 0; answIdx < 5; answIdx++) {
        const answerId = 2000 + answIdx;
        for (let i = 0; i < 12; i++) {
          ps[i].socket.emit('game:vote', { answerId, voteType: 'positive' });
        }
      }

      const collected = await collectPromise;
      const elapsed = Date.now() - start;

      expect(collected).toHaveLength(60);
      expect(gameService.submitVote).toHaveBeenCalledTimes(60);
      expect(elapsed).toBeLessThan(10000);
    });
  });

  // ─── 5. Bağlantı Kopma ve Yeniden Bağlanma ───────────────────
  describe('bağlantı kopma simülasyonu', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('5 oyuncu bağlantı kopar ve yeniden bağlanır', async () => {
      const userIds = [1400, 1401, 1402, 1403, 1404];

      // İlk bağlantı
      for (let i = 0; i < 5; i++) {
        const p = await createPlayerClient(port, { id: userIds[i], username: `reconn${i + 1}` });
        players.push(p);
        expect(p.socket.connected).toBe(true);
      }

      // Hepsini disconnect et
      players.forEach(p => p.socket.disconnect());
      await new Promise(r => setTimeout(r, 200));

      // Yeniden bağlan
      const reconnected = [];
      for (let i = 0; i < 5; i++) {
        const p = await createPlayerClient(port, { id: userIds[i], username: `reconn${i + 1}` });
        reconnected.push(p);
        expect(p.socket.connected).toBe(true);
      }

      players = reconnected;
      expect(reconnected).toHaveLength(5);
    });
  });
});
