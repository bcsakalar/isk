const { createSocketTestServer } = require('../helpers/socketTestServer');
const { createPlayerClient, createPlayers, disconnectAll, resetClientCounter } = require('../helpers/socketTestClient');
const { setGracePeriods } = require('../../server/socket/handlers/room.handler');

// ─── Mock DB Queries ─────────────────────────────────────────────
jest.mock('../../server/db/queries/rooms.queries');
jest.mock('../../server/db/queries/games.queries');
jest.mock('../../server/db/queries/users.queries');
jest.mock('../../server/db/queries/admin.queries');

// ─── Mock Services (handler'lar service katmanını çağırır) ──────
jest.mock('../../server/services/room.service');
jest.mock('../../server/services/game.service');

const roomService = require('../../server/services/room.service');
const roomsQueries = require('../../server/db/queries/rooms.queries');

// ─── Test state ─────────────────────────────────────────────────
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
  // Varsayılan lobby mock
  roomsQueries.listActive.mockResolvedValue([]);
});

// ═════════════════════════════════════════════════════════════════
// TEST SENARYOLARİ
// ═════════════════════════════════════════════════════════════════

describe('Room Lifecycle — E2E Socket Tests', () => {

  // ─── 1. Oda Oluşturma + 5 Oyuncu Katılım ───────────────────
  describe('5 oyunculu oda katılımı', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('owner oda kurar, 4 oyuncu katılır, hepsi room:player_joined alır', async () => {
      const owner = await createPlayerClient(port, { id: 100, username: 'owner' });
      players.push(owner);

      const mockRoom = {
        id: 1, code: 'ABC123', name: 'Test Odası', owner_id: 100,
        status: 'waiting', max_players: 8, total_rounds: 5, time_per_round: 90,
      };
      const mockPlayers = [{ id: 1, user_id: 100, username: 'owner', is_ready: false }];

      // Owner katılır
      roomService.joinRoom.mockResolvedValue({ room: mockRoom, player: mockPlayers[0], alreadyJoined: false });
      roomService.getRoom.mockResolvedValue({ ...mockRoom, players: mockPlayers, categories: [] });
      roomsQueries.listActive.mockResolvedValue([mockRoom]);

      const ownerJoined = owner.emitAndWait('room:join', { code: 'ABC123' }, 'room:joined');
      const roomData = await ownerJoined;
      expect(roomData.room.code).toBe('ABC123');

      // 4 oyuncu katılır
      for (let i = 1; i <= 4; i++) {
        const playerId = 100 + i;
        const playerMock = { id: i + 1, user_id: playerId, username: `player_${i}`, is_ready: false };
        const updatedPlayers = [...mockPlayers, playerMock];

        roomService.joinRoom.mockResolvedValue({ room: mockRoom, player: playerMock, alreadyJoined: false });
        roomService.getRoom.mockResolvedValue({ ...mockRoom, players: updatedPlayers, categories: [] });

        // Mevcut oyuncuların room:player_joined event'ini bekle
        const joinedPromises = players.map(p => p.waitFor('room:player_joined', 3000));

        const newPlayer = await createPlayerClient(port, { id: playerId, username: `player_${i}` });
        players.push(newPlayer);

        // Yeni oyuncu odaya katılır
        const newPlayerJoined = newPlayer.emitAndWait('room:join', { code: 'ABC123' }, 'room:joined');
        await newPlayerJoined;

        // Mevcut oyuncular broadcast almalı
        const joinNotifications = await Promise.all(joinedPromises);
        joinNotifications.forEach(notif => {
          expect(notif.userId).toBe(playerId);
        });

        mockPlayers.push(playerMock);
      }

      expect(players).toHaveLength(5);
      expect(roomService.joinRoom).toHaveBeenCalledTimes(5);
    });
  });

  // ─── 2. Özel Oda + Şifre Doğrulama ─────────────────────────
  describe('özel oda şifre doğrulama (3 oyuncu)', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('yanlış şifre ile katılım hata verir', async () => {
      const player = await createPlayerClient(port, { id: 200 });
      players.push(player);

      roomService.joinRoom.mockRejectedValue(new Error('Yanlış oda şifresi'));

      const errorPromise = player.waitFor('room:error', 3000);
      player.socket.emit('room:join', { code: 'PVT001', password: 'yanlis' });
      const error = await errorPromise;

      expect(error.message).toContain('Yanlış oda şifresi');
    });

    it('doğru şifre ile katılım başarılı', async () => {
      const player = await createPlayerClient(port, { id: 201 });
      players.push(player);

      const mockRoom = { id: 2, code: 'PVT001', name: 'Özel Oda', owner_id: 201, status: 'waiting', is_private: true };
      roomService.joinRoom.mockResolvedValue({ room: mockRoom, player: { id: 1, user_id: 201 }, alreadyJoined: false });
      roomService.getRoom.mockResolvedValue({ ...mockRoom, players: [{ id: 1, user_id: 201 }], categories: [] });

      const result = await player.emitAndWait('room:join', { code: 'PVT001', password: 'dogru123' }, 'room:joined');
      expect(result.room.code).toBe('PVT001');
    });
  });

  // ─── 3. Oda Ayarları Senkronizasyonu (8 oyuncu) ────────────
  describe('oda ayarları senkronizasyonu (8 oyuncu)', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('owner ayar değiştirdiğinde 7 diğer oyuncu room:settings_updated alır', async () => {
      // 8 oyuncu oluştur ve odaya katıl
      const mockRoom = { id: 3, code: 'SET001', name: 'Ayar Test', owner_id: 300, status: 'waiting' };
      const allPlayers = [];

      for (let i = 0; i < 8; i++) {
        const userId = 300 + i;
        const playerMock = { id: i + 1, user_id: userId, username: `p${i}` };
        allPlayers.push(playerMock);

        roomService.joinRoom.mockResolvedValue({ room: mockRoom, player: playerMock, alreadyJoined: false });
        roomService.getRoom.mockResolvedValue({ ...mockRoom, players: allPlayers, categories: [] });

        const player = await createPlayerClient(port, { id: userId, username: `p${i}` });
        players.push(player);

        await player.emitAndWait('room:join', { code: 'SET001' }, 'room:joined');
      }

      // Owner ayar günceller
      const newSettings = { maxPlayers: 10, totalRounds: 8, timePerRound: 120 };
      roomService.updateSettings.mockResolvedValue(newSettings);

      // Non-owner'lar (index 1-7) settings_updated bekler
      const settingsPromises = players.slice(1).map(p => p.waitFor('room:settings_updated', 3000));

      players[0].socket.emit('room:update_settings', newSettings);

      const results = await Promise.all(settingsPromises);
      results.forEach(r => {
        expect(r.settings.maxPlayers).toBe(10);
        expect(r.settings.totalRounds).toBe(8);
      });
    });

    it('non-owner ayar değiştirmeyi denerse hata alır', async () => {
      const mockRoom = { id: 4, code: 'SET002', owner_id: 400, status: 'waiting' };

      roomService.joinRoom.mockResolvedValue({ room: mockRoom, player: { id: 1, user_id: 401 }, alreadyJoined: false });
      roomService.getRoom.mockResolvedValue({ ...mockRoom, players: [{ id: 1, user_id: 401 }], categories: [] });
      roomService.updateSettings.mockRejectedValue(new Error('Sadece oda sahibi ayarları değiştirebilir'));

      const player = await createPlayerClient(port, { id: 401 });
      players.push(player);

      await player.emitAndWait('room:join', { code: 'SET002' }, 'room:joined');

      const error = player.waitFor('room:error', 3000);
      player.socket.emit('room:update_settings', { maxPlayers: 15 });
      const err = await error;
      expect(err.message).toContain('oda sahibi');
    });
  });

  // ─── 4. Kategori Yönetimi (4 oyuncu) ───────────────────────
  describe('kategori yönetimi (4 oyuncu)', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('owner kategori ekler, tüm oyuncular room:categories_updated alır', async () => {
      const mockRoom = { id: 5, code: 'CAT001', owner_id: 500, status: 'waiting' };

      for (let i = 0; i < 4; i++) {
        const userId = 500 + i;
        roomService.joinRoom.mockResolvedValue({ room: mockRoom, player: { id: i + 1, user_id: userId }, alreadyJoined: false });
        roomService.getRoom.mockResolvedValue({ ...mockRoom, players: [], categories: [] });

        const player = await createPlayerClient(port, { id: userId });
        players.push(player);
        await player.emitAndWait('room:join', { code: 'CAT001' }, 'room:joined');
      }

      const newCategories = [{ id: 1, name: 'İsim', slug: 'isim' }, { id: 2, name: 'Şehir', slug: 'sehir' }, { id: 99, name: 'Yemek', slug: 'yemek' }];
      roomService.addCategory.mockResolvedValue(newCategories);

      const catPromises = players.slice(1).map(p => p.waitFor('room:categories_updated', 3000));
      players[0].socket.emit('room:add_category', { name: 'Yemek' });

      const results = await Promise.all(catPromises);
      results.forEach(r => {
        expect(r.categories).toHaveLength(3);
        expect(r.categories[2].name).toBe('Yemek');
      });
    });

    it('owner kategori kaldırır, tüm oyuncular güncelleme alır', async () => {
      const mockRoom = { id: 6, code: 'CAT002', owner_id: 600, status: 'waiting' };

      for (let i = 0; i < 4; i++) {
        const userId = 600 + i;
        roomService.joinRoom.mockResolvedValue({ room: mockRoom, player: { id: i + 1, user_id: userId }, alreadyJoined: false });
        roomService.getRoom.mockResolvedValue({ ...mockRoom, players: [], categories: [] });

        const player = await createPlayerClient(port, { id: userId });
        players.push(player);
        await player.emitAndWait('room:join', { code: 'CAT002' }, 'room:joined');
      }

      const remainingCats = [{ id: 1, name: 'İsim', slug: 'isim' }];
      roomService.removeCategory.mockResolvedValue(remainingCats);

      const catPromises = players.slice(1).map(p => p.waitFor('room:categories_updated', 3000));
      players[0].socket.emit('room:remove_category', { categoryId: 2 });

      const results = await Promise.all(catPromises);
      results.forEach(r => {
        expect(r.categories).toHaveLength(1);
      });
    });
  });

  // ─── 5. Harf Seçimi Senkronizasyonu (6 oyuncu) ─────────────
  describe('harf seçimi senkronizasyonu (6 oyuncu)', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('owner harfleri günceller, tüm oyuncular room:letters_updated alır', async () => {
      const mockRoom = { id: 7, code: 'LTR001', owner_id: 700, status: 'waiting' };

      for (let i = 0; i < 6; i++) {
        const userId = 700 + i;
        roomService.joinRoom.mockResolvedValue({ room: mockRoom, player: { id: i + 1, user_id: userId }, alreadyJoined: false });
        roomService.getRoom.mockResolvedValue({ ...mockRoom, players: [], categories: [] });

        const player = await createPlayerClient(port, { id: userId });
        players.push(player);
        await player.emitAndWait('room:join', { code: 'LTR001' }, 'room:joined');
      }

      const selectedLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'İ'];
      roomService.updateLetters.mockResolvedValue(selectedLetters);

      const letterPromises = players.slice(1).map(p => p.waitFor('room:letters_updated', 3000));
      players[0].socket.emit('room:update_letters', { letters: selectedLetters });

      const results = await Promise.all(letterPromises);
      results.forEach(r => {
        expect(r.letters).toEqual(selectedLetters);
      });
    });
  });

  // ─── 6. Hazır Sistemi (10 oyuncu) ──────────────────────────
  describe('hazır sistemi (10 oyuncu)', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('10 oyuncu sırayla hazır olur, son oyuncuda allReady: true', async () => {
      const mockRoom = { id: 8, code: 'RDY001', owner_id: 800, status: 'waiting' };
      const playerMocks = [];

      for (let i = 0; i < 10; i++) {
        const userId = 800 + i;
        const pMock = { id: i + 1, user_id: userId, username: `p${i}`, is_ready: false };
        playerMocks.push(pMock);

        roomService.joinRoom.mockResolvedValue({ room: mockRoom, player: pMock, alreadyJoined: false });
        roomService.getRoom.mockResolvedValue({ ...mockRoom, players: playerMocks, categories: [] });

        const player = await createPlayerClient(port, { id: userId });
        players.push(player);
        await player.emitAndWait('room:join', { code: 'RDY001' }, 'room:joined');
      }

      // Sırayla hazır ol
      for (let i = 0; i < 10; i++) {
        const readyPlayers = playerMocks.map((p, idx) => ({
          ...p,
          is_ready: idx <= i,
        }));
        const allReady = i === 9; // Son oyuncu hazır olunca allReady

        roomService.setReady.mockResolvedValue({
          players: readyPlayers,
          allReady,
        });

        // Diğer oyuncular ready_update bekler
        const readyPromises = players
          .filter((_, idx) => idx !== i)
          .map(p => p.waitFor('room:ready_update', 3000));

        players[i].socket.emit('room:ready', { ready: true });

        const results = await Promise.all(readyPromises);
        results.forEach(r => {
          expect(r.allReady).toBe(allReady);
          expect(r.userId).toBe(800 + i);
        });
      }
    });
  });

  // ─── 7. Sahiplik Devri (4 oyuncu) ──────────────────────────
  describe('sahiplik devri (4 oyuncu)', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('owner sahipliği devreder, tüm oyuncular room:owner_changed alır', async () => {
      const mockRoom = { id: 9, code: 'OWN001', owner_id: 900, status: 'waiting' };

      for (let i = 0; i < 4; i++) {
        const userId = 900 + i;
        roomService.joinRoom.mockResolvedValue({ room: mockRoom, player: { id: i + 1, user_id: userId }, alreadyJoined: false });
        roomService.getRoom.mockResolvedValue({ ...mockRoom, players: [], categories: [] });

        const player = await createPlayerClient(port, { id: userId });
        players.push(player);
        await player.emitAndWait('room:join', { code: 'OWN001' }, 'room:joined');
      }

      // Sahipliği 2. oyuncuya devret
      roomService.transferOwnership.mockResolvedValue({ newOwnerId: 901 });
      const updatedRoom = { ...mockRoom, owner_id: 901 };
      roomService.getRoom.mockResolvedValue({ ...updatedRoom, players: [], categories: [] });

      const ownerChangedPromises = players.slice(1).map(p => p.waitFor('room:owner_changed', 3000));
      players[0].socket.emit('room:transfer_ownership', { targetUserId: 901 });

      const results = await Promise.all(ownerChangedPromises);
      results.forEach(r => {
        expect(r.newOwnerId).toBe(901);
      });
    });
  });

  // ─── 8. Oyuncu Ayrılma + Otomatik Sahiplik Devri ──────────
  describe('disconnect + otomatik sahiplik devri (5 oyuncu)', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('owner disconnect olunca yeni sahip atanır ve room:owner_changed broadcast edilir', async () => {
      const mockRoom = { id: 10, code: 'DCN001', owner_id: 1000, status: 'waiting' };
      const playerMocks = [];

      for (let i = 0; i < 5; i++) {
        const userId = 1000 + i;
        const pMock = { id: i + 1, user_id: userId, username: `p${i}` };
        playerMocks.push(pMock);

        roomService.joinRoom.mockResolvedValue({ room: mockRoom, player: pMock, alreadyJoined: false });
        roomService.getRoom.mockResolvedValue({ ...mockRoom, players: playerMocks, categories: [] });

        const player = await createPlayerClient(port, { id: userId });
        players.push(player);
        await player.emitAndWait('room:join', { code: 'DCN001' }, 'room:joined');
      }

      // Owner disconnect → yeni sahip: 1001
      roomService.leaveRoom.mockResolvedValue({ playerCount: 4, newOwnerId: 1001 });
      roomsQueries.getPlayers.mockResolvedValue(playerMocks.slice(1));
      roomsQueries.findById.mockResolvedValue(mockRoom);
      const updatedRoom = { ...mockRoom, owner_id: 1001 };
      roomService.getRoom.mockResolvedValue({ ...updatedRoom, players: playerMocks.slice(1), categories: [] });

      // Kalan oyuncular event'leri bekler
      const leftPromises = players.slice(1).map(p => p.waitFor('room:player_left', 3000));
      const ownerPromises = players.slice(1).map(p => p.waitFor('room:owner_changed', 3000));

      // Owner disconnect
      players[0].disconnect();

      const leftResults = await Promise.all(leftPromises);
      leftResults.forEach(r => {
        expect(r.userId).toBe(1000);
      });

      const ownerResults = await Promise.all(ownerPromises);
      ownerResults.forEach(r => {
        expect(r.newOwnerId).toBe(1001);
      });
    });
  });

  // ─── 9. Kapasite Kontrolü ──────────────────────────────────
  describe('kapasite kontrolü (8/8 dolu + 1 fazla)', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('kapasite dolu iken 9. oyuncu katılamaz', async () => {
      const mockRoom = { id: 11, code: 'CAP001', owner_id: 1100, status: 'waiting', max_players: 8 };

      // 8 oyuncu katıl
      for (let i = 0; i < 8; i++) {
        const userId = 1100 + i;
        roomService.joinRoom.mockResolvedValue({ room: mockRoom, player: { id: i + 1, user_id: userId }, alreadyJoined: false });
        roomService.getRoom.mockResolvedValue({ ...mockRoom, players: [], categories: [] });

        const player = await createPlayerClient(port, { id: userId });
        players.push(player);
        await player.emitAndWait('room:join', { code: 'CAP001' }, 'room:joined');
      }

      // 9. oyuncu → hata
      roomService.joinRoom.mockRejectedValue(new Error('Oda dolu'));

      const ninthPlayer = await createPlayerClient(port, { id: 1108 });
      players.push(ninthPlayer);

      const error = ninthPlayer.waitFor('room:error', 3000);
      ninthPlayer.socket.emit('room:join', { code: 'CAP001' });
      const err = await error;
      expect(err.message).toContain('Oda dolu');
    });
  });
});
