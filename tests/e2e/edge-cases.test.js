const { createSocketTestServer } = require('../helpers/socketTestServer');
const { createPlayerClient, disconnectAll, resetClientCounter } = require('../helpers/socketTestClient');
const { setGracePeriods } = require('../../server/socket/handlers/room.handler');

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
const adminQueries = require('../../server/db/queries/admin.queries');

let testServer;
let port;

beforeAll(async () => {
  // Test ortamında kısa grace period kullan (hızlı testler için)
  setGracePeriods(200, 200);
  testServer = await createSocketTestServer();
  port = testServer.port;
});

afterAll(async () => {
  await testServer.close();
  setGracePeriods(30000, 15000);
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
    id: roomId, code: 'EDGE01', name: 'Edge Case Odası', owner_id: ownerId,
    status: 'waiting', max_players: 16,
  };

  for (let i = 0; i < players.length; i++) {
    const userId = players[i].userId || (ownerId + i);
    roomService.joinRoom.mockResolvedValueOnce({
      room: mockRoom,
      player: { user_id: userId, username: `p${i + 1}`, is_ready: false, total_score: 0 },
    });
    roomsQueries.getPlayers.mockResolvedValueOnce(
      Array.from({ length: i + 1 }, (_, j) => ({
        user_id: ownerId + j, username: `p${j + 1}`, is_ready: false, total_score: 0,
      }))
    );

    const joinPromise = players[i].waitFor('room:joined', 3000);
    players[i].socket.emit('room:join', { roomId, password: null });
    await joinPromise;
  }

  return mockRoom;
}

// ═════════════════════════════════════════════════════════════════
// EDGE CASES
// ═════════════════════════════════════════════════════════════════

describe('Edge Cases — E2E Socket Tests', () => {
  // ─── 1. Oyun Ortasında Disconnect — 8 Oyuncu ─────────────────
  describe('oyun ortasında disconnect (8 oyuncu)', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('oyun ortasında 3 oyuncu ayrılınca kalanlar devam eder', async () => {
      const ps = [];
      for (let i = 0; i < 8; i++) {
        const p = await createPlayerClient(port, { id: 100 + i, username: `edge${i + 1}` });
        p.userId = 100 + i;
        ps.push(p);
      }
      players = ps;

      await joinRoom(ps, 1, 100);

      // Oyun başlat
      gameService.startGame.mockResolvedValueOnce({
        room: { id: 1, time_per_round: 90, total_rounds: 3 },
        round: { id: 1, round_number: 1, letter: 'A' },
        players: ps.map((p, i) => ({ user_id: p.userId, username: `edge${i + 1}`, total_score: 0 })),
      });

      const startPromises = ps.map(p => p.waitFor('game:started', 3000));
      ps[0].socket.emit('game:start');
      await Promise.all(startPromises);

      // 3 oyuncu disconnect olur
      for (let i = 5; i < 8; i++) {
        roomService.leaveRoom.mockResolvedValueOnce({ newOwnerId: null });
        roomsQueries.getPlayers.mockResolvedValueOnce(
          ps.slice(0, 5).map((p, j) => ({ user_id: p.userId, username: `edge${j + 1}` }))
        );
        ps[i].socket.disconnect();
      }

      // Kısa bekle — disconnect handler'ların çalışması için
      await new Promise(r => setTimeout(r, 300));

      // Kalan 5 oyuncu cevap gönderir
      const categories = [{ id: 1, slug: 'isim' }, { id: 2, slug: 'sehir' }];
      roomsQueries.getCategories.mockResolvedValue(categories);
      gameService.submitAnswers.mockResolvedValue(true);

      for (let i = 0; i < 5; i++) {
        const submittedPromise = ps[i].waitFor('game:answers_submitted', 3000);
        ps[i].socket.emit('game:submit_answers', {
          answers: { isim: 'Ali', sehir: 'Ankara' },
        });
        const result = await submittedPromise;
        expect(result.success).toBe(true);
      }

      // Sadece alive player'ları tutuyoruz
      players = ps.slice(0, 5);
    });
  });

  // ─── 2. Sahip Oyun Ortasında Ayrılır ────────────────────────
  describe('oda sahibi oyun ortasında ayrılır', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('sahip ayrılınca sahiplik devredilir ve oyun devam eder', async () => {
      const ps = [];
      for (let i = 0; i < 5; i++) {
        const p = await createPlayerClient(port, { id: 200 + i, username: `owner_edge${i + 1}` });
        p.userId = 200 + i;
        ps.push(p);
      }
      players = ps;

      const mockRoom = await joinRoom(ps, 2, 200);

      // Oyun başlat
      gameService.startGame.mockResolvedValueOnce({
        room: { id: 2, time_per_round: 90, total_rounds: 3 },
        round: { id: 10, round_number: 1, letter: 'B' },
        players: ps.map((p, i) => ({ user_id: p.userId, username: `owner_edge${i + 1}`, total_score: 0 })),
      });

      const startPromises = ps.map(p => p.waitFor('game:started', 3000));
      ps[0].socket.emit('game:start');
      await Promise.all(startPromises);

      // Sahip (ps[0]) disconnect — sahiplik ps[1]'e devredilir
      roomService.leaveRoom.mockResolvedValueOnce({ newOwnerId: 201 });
      roomsQueries.getPlayers.mockResolvedValueOnce(
        ps.slice(1).map((p, j) => ({ user_id: p.userId, username: `owner_edge${j + 2}` }))
      );
      roomService.getRoom.mockResolvedValueOnce({ ...mockRoom, owner_id: 201 });
      roomsQueries.findById.mockResolvedValue(mockRoom);

      const ownerChangedPromises = ps.slice(1).map(p => p.waitFor('room:owner_changed', 3000));
      ps[0].socket.disconnect();

      const results = await Promise.all(ownerChangedPromises);
      results.forEach(r => {
        expect(r.newOwnerId).toBe(201);
      });

      players = ps.slice(1);
    });
  });

  // ─── 3. Geçersiz Veri (XSS / Injection) ─────────────────────
  describe('geçersiz ve zararlı veri girişleri', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('XSS içeren mesaj sanitize edilir', async () => {
      const p = await createPlayerClient(port, { id: 300, username: 'xss_test' });
      p.userId = 300;
      players.push(p);

      await joinRoom([p], 10, 300);

      const xssMessage = '<script>alert("xss")</script>Merhaba';
      gamesQueries.saveMessage.mockResolvedValueOnce({
        id: 1, created_at: new Date().toISOString(),
      });

      const msgPromise = p.waitFor('chat:room_message', 3000);
      p.socket.emit('chat:room', { message: xssMessage });

      const result = await msgPromise;
      // DOMPurify script tag'ini temizlemeli
      expect(result.message).not.toContain('<script>');
      expect(result.message).toContain('Merhaba');
    });

    it('boş mesaj sessizce reddedilir', async () => {
      const p = await createPlayerClient(port, { id: 301, username: 'empty_msg' });
      p.userId = 301;
      players.push(p);

      await joinRoom([p], 11, 301);

      p.socket.emit('chat:room', { message: '' });
      p.socket.emit('chat:room', { message: '   ' });

      // 300ms bekle — mesaj gelmemeli
      await new Promise(r => setTimeout(r, 300));
      expect(gamesQueries.saveMessage).not.toHaveBeenCalled();
    });

    it('500+ karakter mesaj sessizce reddedilir', async () => {
      const p = await createPlayerClient(port, { id: 302, username: 'long_msg' });
      p.userId = 302;
      players.push(p);

      await joinRoom([p], 12, 302);

      const longMessage = 'A'.repeat(501);
      p.socket.emit('chat:room', { message: longMessage });

      await new Promise(r => setTimeout(r, 300));
      expect(gamesQueries.saveMessage).not.toHaveBeenCalled();
    });

    it('geçersiz cevap formatı hata döner', async () => {
      const p = await createPlayerClient(port, { id: 303, username: 'bad_answer' });
      p.userId = 303;
      players.push(p);

      const mockRoom = await joinRoom([p], 3, 303);

      // Dizi yerine string gönder
      const errorPromise = p.waitFor('game:error', 3000);
      p.socket.emit('game:submit_answers', { answers: 'invalid' });

      const err = await errorPromise;
      expect(err.message).toBe('Geçersiz cevap formatı');
    });

    it('array answers formatı hata döner', async () => {
      const p = await createPlayerClient(port, { id: 304, username: 'arr_answer' });
      p.userId = 304;
      players.push(p);

      await joinRoom([p], 4, 304);

      const errorPromise = p.waitFor('game:error', 3000);
      p.socket.emit('game:submit_answers', { answers: ['not', 'valid'] });

      const err = await errorPromise;
      expect(err.message).toBe('Geçersiz cevap formatı');
    });
  });

  // ─── 4. Admin İşlemleri ──────────────────────────────────────
  describe('admin işlemleri', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('admin duyuru gönderir — tüm kullanıcılara yayınlanır', async () => {
      const admin = await createPlayerClient(port, { id: 400, username: 'admin1', role: 'admin' });
      const user1 = await createPlayerClient(port, { id: 401, username: 'user1' });
      const user2 = await createPlayerClient(port, { id: 402, username: 'user2' });
      players = [admin, user1, user2];

      adminQueries.createAnnouncement.mockResolvedValueOnce({ id: 1 });
      adminQueries.logAction.mockResolvedValueOnce(true);

      const announcePromises = [user1, user2].map(p => p.waitFor('announcement', 3000));
      admin.socket.emit('admin:announce', {
        title: 'Test Duyuru',
        content: 'Sistem bakıma alınacak',
        target: 'all',
      });

      const results = await Promise.all(announcePromises);
      results.forEach(r => {
        expect(r.title).toBe('Test Duyuru');
        expect(r.content).toBe('Sistem bakıma alınacak');
      });
    });

    it('non-admin duyuru gönderemez', async () => {
      const user = await createPlayerClient(port, { id: 410, username: 'notadmin', role: 'player' });
      players.push(user);

      user.socket.emit('admin:announce', {
        title: 'Hack',
        content: 'Bu çalışmamalı',
        target: 'all',
      });

      await new Promise(r => setTimeout(r, 300));
      expect(adminQueries.createAnnouncement).not.toHaveBeenCalled();
    });

    it('admin kullanıcıyı odadan atar', async () => {
      const admin = await createPlayerClient(port, { id: 420, username: 'admin2', role: 'admin' });
      const victim = await createPlayerClient(port, { id: 421, username: 'victim' });
      victim.userId = 421;
      const bystander = await createPlayerClient(port, { id: 422, username: 'bystander' });
      bystander.userId = 422;
      players = [admin, victim, bystander];

      // Victim ve bystander odaya katılır
      await joinRoom([victim, bystander], 10, 421);

      roomsQueries.removePlayer.mockResolvedValueOnce(true);
      adminQueries.logAction.mockResolvedValueOnce(true);

      const kickedPromise = victim.waitFor('room:kicked', 3000);
      const kickNotifyPromise = bystander.waitFor('room:player_kicked', 3000);

      admin.socket.emit('admin:kick_user', { userId: 421, roomId: 10 });

      const kickResult = await kickedPromise;
      expect(kickResult.reason).toContain('Admin');

      const notify = await kickNotifyPromise;
      expect(notify.userId).toBe(421);
    });

    it('admin odayı kapatır — tüm oyuncular bildirim alır', async () => {
      const admin = await createPlayerClient(port, { id: 430, username: 'admin3', role: 'admin' });
      const p1 = await createPlayerClient(port, { id: 431, username: 'roomuser1' });
      p1.userId = 431;
      const p2 = await createPlayerClient(port, { id: 432, username: 'roomuser2' });
      p2.userId = 432;
      players = [admin, p1, p2];

      await joinRoom([p1, p2], 11, 431);

      roomsQueries.updateStatus.mockResolvedValueOnce(true);
      adminQueries.logAction.mockResolvedValueOnce(true);

      const closedPromises = [p1, p2].map(p => p.waitFor('room:closed', 3000));
      admin.socket.emit('admin:close_room', { roomId: 11 });

      const results = await Promise.all(closedPromises);
      results.forEach(r => {
        expect(r.reason).toContain('admin');
      });
    });
  });

  // ─── 5. Odası Olmayan Socket Event'leri ──────────────────────
  describe('oda dışı event gönderimi', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('odada olmayan oyuncu cevap gönderemez', async () => {
      const p = await createPlayerClient(port, { id: 500, username: 'noroom1' });
      players.push(p);

      // currentRoom set edilmemiş — event sessizce ignored
      p.socket.emit('game:submit_answers', { answers: { isim: 'Test' } });
      p.socket.emit('game:vote', { answerId: 1, voteType: 'positive' });
      p.socket.emit('game:start');

      await new Promise(r => setTimeout(r, 300));
      expect(gameService.submitAnswers).not.toHaveBeenCalled();
      expect(gameService.submitVote).not.toHaveBeenCalled();
      expect(gameService.startGame).not.toHaveBeenCalled();
    });

    it('odada olmayan oyuncu oda chat gönderemez', async () => {
      const p = await createPlayerClient(port, { id: 501, username: 'noroom2' });
      players.push(p);

      p.socket.emit('chat:room', { message: 'Bu gitmemeli' });
      p.socket.emit('chat:reaction', { emoji: '🔥' });

      await new Promise(r => setTimeout(r, 300));
      expect(gamesQueries.saveMessage).not.toHaveBeenCalled();
    });
  });

  // ─── 6. JWT Doğrulama ────────────────────────────────────────
  describe('JWT doğrulama', () => {
    it('geçersiz token ile bağlanılamaz', async () => {
      const { io: Client } = require('socket.io-client');

      const socket = Client(`http://localhost:${port}`, {
        auth: { token: 'invalid-jwt-token' },
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      });

      const error = await new Promise((resolve) => {
        socket.on('connect_error', (err) => {
          resolve(err);
        });
      });

      expect(error).toBeDefined();
      socket.disconnect();
    });

    it('token olmadan bağlanılamaz', async () => {
      const { io: Client } = require('socket.io-client');

      const socket = Client(`http://localhost:${port}`, {
        auth: {},
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      });

      const error = await new Promise((resolve) => {
        socket.on('connect_error', (err) => {
          resolve(err);
        });
      });

      expect(error).toBeDefined();
      socket.disconnect();
    });
  });

  // ─── 7. Hızlı Arka Arkaya İşlemler ──────────────────────────
  describe('hızlı arka arkaya işlemler', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('aynı oyuncu hızlıca 3 odaya katılıp çıkar', async () => {
      const p = await createPlayerClient(port, { id: 600, username: 'rapid' });
      p.userId = 600;
      players.push(p);

      for (let roomId = 20; roomId < 23; roomId++) {
        const mockRoom = {
          id: roomId, code: `R${roomId}`, name: `Oda ${roomId}`, owner_id: 600,
          status: 'waiting', max_players: 8,
        };
        roomService.joinRoom.mockResolvedValueOnce({
          room: mockRoom,
          player: { user_id: 600, username: 'rapid', is_ready: false, total_score: 0 },
        });
        roomsQueries.getPlayers.mockResolvedValueOnce([
          { user_id: 600, username: 'rapid', is_ready: false, total_score: 0 },
        ]);

        const joinPromise = p.waitFor('room:joined', 3000);
        p.socket.emit('room:join', { roomId, password: null });
        await joinPromise;

        // Odadan çık
        roomService.leaveRoom.mockResolvedValueOnce({ newOwnerId: null });
        roomsQueries.getPlayers.mockResolvedValueOnce([]);

        p.socket.emit('room:leave');
        await new Promise(r => setTimeout(r, 100));
      }

      // 3 oda katılımı başarılı oldu
      expect(roomService.joinRoom).toHaveBeenCalledTimes(3);
    });
  });
});
