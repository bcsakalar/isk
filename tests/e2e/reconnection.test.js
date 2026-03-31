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

// ─── Test state ─────────────────────────────────────────────────
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
// RECONNECTION (GRACE PERIOD) TESTLERİ
// ═════════════════════════════════════════════════════════════════

describe('Reconnection — Disconnect Grace Period', () => {
  const mockRoom = {
    id: 1, code: 'ABC123', name: 'Test Odası', owner_id: 100,
    status: 'playing', max_players: 8, total_rounds: 5, time_per_round: 90,
  };

  const mockWaitingRoom = {
    ...mockRoom,
    status: 'waiting',
  };

  const mockPlayers = [
    { id: 1, user_id: 100, username: 'owner', is_ready: false },
    { id: 2, user_id: 101, username: 'player_1', is_ready: false },
  ];

  // ─── 1. Disconnect sırasında diğer oyunculara bildirim ─────
  it('disconnect olunca diğer oyunculara room:player_disconnected göndermeli', async () => {
    const players = [];
    try {
      // Owner odaya katılır
      const owner = await createPlayerClient(port, { id: 100, username: 'owner' });
      players.push(owner);

      roomService.joinRoom.mockResolvedValue({ room: mockRoom, player: mockPlayers[0], alreadyJoined: false });
      roomService.getRoom.mockResolvedValue({ ...mockRoom, players: mockPlayers, categories: [] });

      await owner.emitAndWait('room:join', { code: 'ABC123' }, 'room:joined');

      // Player 2 odaya katılır
      const player2 = await createPlayerClient(port, { id: 101, username: 'player_1' });
      players.push(player2);

      roomService.joinRoom.mockResolvedValue({ room: mockRoom, player: mockPlayers[1], alreadyJoined: false });
      roomService.getRoom.mockResolvedValue({ ...mockRoom, players: mockPlayers, categories: [] });

      await player2.emitAndWait('room:join', { code: 'ABC123' }, 'room:joined');

      // Owner disconnect beklemesi ayarla
      roomsQueries.findById.mockResolvedValue(mockRoom);
      const disconnectEvent = player2.waitFor('room:player_disconnected', 3000);

      // Owner'ı disconnect et
      owner.disconnect();

      const data = await disconnectEvent;
      expect(data.userId).toBe(100);
      expect(data.gracePeriod).toBe(30000); // playing durumunda 30s
    } finally {
      disconnectAll(players);
    }
  });

  // ─── 2. Waiting durumunda grace period 15s olmalı ──────────
  it('waiting durumunda grace period 15s olmalı', async () => {
    const players = [];
    try {
      const owner = await createPlayerClient(port, { id: 200, username: 'owner2' });
      players.push(owner);

      roomService.joinRoom.mockResolvedValue({ room: mockWaitingRoom, player: mockPlayers[0], alreadyJoined: false });
      roomService.getRoom.mockResolvedValue({ ...mockWaitingRoom, players: mockPlayers, categories: [] });

      await owner.emitAndWait('room:join', { code: 'ABC123' }, 'room:joined');

      const player2 = await createPlayerClient(port, { id: 201, username: 'player_2' });
      players.push(player2);

      roomService.joinRoom.mockResolvedValue({ room: mockWaitingRoom, player: mockPlayers[1], alreadyJoined: false });
      roomService.getRoom.mockResolvedValue({ ...mockWaitingRoom, players: mockPlayers, categories: [] });

      await player2.emitAndWait('room:join', { code: 'ABC123' }, 'room:joined');

      roomsQueries.findById.mockResolvedValue(mockWaitingRoom);
      const disconnectEvent = player2.waitFor('room:player_disconnected', 3000);

      owner.disconnect();

      const data = await disconnectEvent;
      expect(data.gracePeriod).toBe(15000); // waiting durumunda 15s
    } finally {
      disconnectAll(players);
    }
  });

  // ─── 3. Reconnect sonrası grace period iptal olmalı ────────
  it('grace period içinde rejoin olursa room:player_reconnected göndermeli', async () => {
    const players = [];
    try {
      const owner = await createPlayerClient(port, { id: 300, username: 'owner3' });
      players.push(owner);

      roomService.joinRoom.mockResolvedValue({ room: mockRoom, player: mockPlayers[0], alreadyJoined: false });
      roomService.getRoom.mockResolvedValue({ ...mockRoom, players: mockPlayers, categories: [] });

      await owner.emitAndWait('room:join', { code: 'ABC123' }, 'room:joined');

      const player2 = await createPlayerClient(port, { id: 301, username: 'player_3' });
      players.push(player2);

      roomService.joinRoom.mockResolvedValue({ room: mockRoom, player: mockPlayers[1], alreadyJoined: false });
      roomService.getRoom.mockResolvedValue({ ...mockRoom, players: mockPlayers, categories: [] });

      await player2.emitAndWait('room:join', { code: 'ABC123' }, 'room:joined');

      // Owner disconnect
      roomsQueries.findById.mockResolvedValue(mockRoom);
      const disconnectEvent = player2.waitFor('room:player_disconnected', 3000);
      owner.disconnect();
      await disconnectEvent;

      // Reconnect event bekle
      const reconnectEvent = player2.waitFor('room:player_reconnected', 3000);

      // Owner yeni socket ile geri döner
      const ownerReconnected = await createPlayerClient(port, { id: 300, username: 'owner3' });
      players.push(ownerReconnected);

      // Rejoin mock
      roomsQueries.getPlayerByRoomAndUser.mockResolvedValue(mockPlayers[0]);
      roomsQueries.findById.mockResolvedValue(mockRoom);

      ownerReconnected.socket.emit('room:rejoin', { roomId: 1 });

      const data = await reconnectEvent;
      expect(data.userId).toBe(300);

      // leaveRoom çağrılmamalı (grace period iptal edildi)
      expect(roomService.leaveRoom).not.toHaveBeenCalled();
    } finally {
      disconnectAll(players);
    }
  });

  // ─── 4. Aktif olmayan odada disconnect — direkt çıkış ──────
  it('abandoned odada direkt leaveRoom çağırmalı', async () => {
    const players = [];
    try {
      const owner = await createPlayerClient(port, { id: 400, username: 'owner4' });
      players.push(owner);

      const abandonedRoom = { ...mockRoom, id: 2, status: 'abandoned' };
      roomService.joinRoom.mockResolvedValue({ room: abandonedRoom, player: mockPlayers[0], alreadyJoined: false });
      roomService.getRoom.mockResolvedValue({ ...abandonedRoom, players: mockPlayers, categories: [] });

      await owner.emitAndWait('room:join', { code: 'ABC123' }, 'room:joined');

      // Disconnect sırasında abandoned oda durumu
      roomsQueries.findById.mockResolvedValue(abandonedRoom);
      roomService.leaveRoom.mockResolvedValue({ abandoned: false });

      owner.disconnect();

      // Grace period olmadan direkt leaveRoom çağrılmalı
      await new Promise(r => setTimeout(r, 500));
      expect(roomService.leaveRoom).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 400, roomId: 2 })
      );
    } finally {
      disconnectAll(players);
    }
  });

  // ─── 5. Finished odada disconnect — grace period ile çıkış ──────
  it('finished odada grace period uygulamalı (skor tablosunu görebilsin)', async () => {
    const players = [];
    try {
      const owner = await createPlayerClient(port, { id: 500, username: 'owner5' });
      players.push(owner);

      const finishedRoom = { ...mockRoom, id: 3, status: 'finished' };
      roomService.joinRoom.mockResolvedValue({ room: finishedRoom, player: mockPlayers[0], alreadyJoined: false });
      roomService.getRoom.mockResolvedValue({ ...finishedRoom, players: mockPlayers, categories: [] });

      await owner.emitAndWait('room:join', { code: 'ABC123' }, 'room:joined');

      // Disconnect sırasında finished oda durumu
      roomsQueries.findById.mockResolvedValue(finishedRoom);
      roomService.leaveRoom.mockResolvedValue({ abandoned: false });

      owner.disconnect();

      // Finished odada direkt leaveRoom çağrılmamalı — grace period uygulanmalı
      await new Promise(r => setTimeout(r, 500));
      expect(roomService.leaveRoom).not.toHaveBeenCalled();
    } finally {
      disconnectAll(players);
    }
  });
});
