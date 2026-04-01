const { createSocketTestServer } = require('../helpers/socketTestServer');
const { createPlayerClient, createPlayers, disconnectAll, resetClientCounter } = require('../helpers/socketTestClient');
const { clearAllTimers } = require('../../server/socket/handlers/game.handler');

// ─── Mock DB Queries ─────────────────────────────────────────────
jest.mock('../../server/db/queries/rooms.queries');
jest.mock('../../server/db/queries/games.queries');
jest.mock('../../server/db/queries/users.queries');
jest.mock('../../server/db/queries/admin.queries');

// ─── Mock Services ──────────────────────────────────────────────
jest.mock('../../server/services/room.service');
jest.mock('../../server/services/game.service');

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
  clearAllTimers();
  roomsQueries.listActive.mockResolvedValue([]);
});

// ═════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════

async function setupRoomInVoting(playerCount, roomId = 10, ownerId = 200) {
  const mockRoom = {
    id: roomId, code: 'VOTE01', name: 'Oylama Odası', owner_id: ownerId,
    status: 'voting', max_players: 16, total_rounds: 3, time_per_round: 90,
  };
  const players = [];

  jest.mock('../../server/services/room.service');
  const roomService = require('../../server/services/room.service');

  for (let i = 0; i < playerCount; i++) {
    const userId = ownerId + i;
    const p = await createPlayerClient(port, { id: userId, username: `voter${i + 1}` });
    p.userId = userId;
    p.roomId = roomId;

    roomService.joinRoom.mockResolvedValueOnce({
      room: mockRoom,
      player: { user_id: userId, username: `voter${i + 1}`, is_ready: false, total_score: 0 },
    });
    roomsQueries.getPlayers.mockResolvedValueOnce(
      Array.from({ length: i + 1 }, (_, j) => ({
        user_id: ownerId + j, username: `voter${j + 1}`, is_ready: false, total_score: 0,
      }))
    );

    const joinPromise = p.waitFor('room:joined', 3000);
    p.socket.emit('room:join', { roomId, password: null });
    await joinPromise;
    players.push(p);
  }

  return { mockRoom, players };
}

// ═════════════════════════════════════════════════════════════════
// OY VERME TESTLERİ
// ═════════════════════════════════════════════════════════════════

describe('Voting & Evidence — E2E Socket Tests', () => {
  // ─── 1. Oylama Akışı — 5 Oyuncu ──────────────────────────────
  describe('oylama akışı (5 oyuncu)', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('her oyuncu oy verir ve tüm odaya vote_update yayınlanır', async () => {
      const { players: ps } = await setupRoomInVoting(5);
      players = ps;

      // 5 farklı cevaba oy verilecek
      for (let i = 0; i < 5; i++) {
        const answerId = 100 + i;
        const voteType = i % 2 === 0 ? 'positive' : 'negative';

        gameService.submitVote.mockResolvedValueOnce(true);
        gamesQueries.getVoteCountsForAnswer.mockResolvedValueOnce({
          positive: voteType === 'positive' ? '1' : '0',
          negative: voteType === 'negative' ? '1' : '0',
        });

        const updatePromises = players.map(p => p.waitFor('game:vote_update', 3000));
        players[i].socket.emit('game:vote', { answerId, voteType });

        const results = await Promise.all(updatePromises);
        results.forEach(r => {
          expect(r.answerId).toBe(answerId);
          expect(typeof r.positive).toBe('number');
          expect(typeof r.negative).toBe('number');
        });
      }
    });

    it('aynı cevaba birden fazla oyuncu oy verir — oy sayıları doğru güncellenir', async () => {
      const { players: ps } = await setupRoomInVoting(5);
      players = ps;

      const answerId = 500;
      let positiveCount = 0;

      // 5 oyuncu sırayla aynı cevaba oy verir
      for (let i = 0; i < 5; i++) {
        positiveCount++;
        gameService.submitVote.mockResolvedValueOnce(true);
        gamesQueries.getVoteCountsForAnswer.mockResolvedValueOnce({
          positive: String(positiveCount),
          negative: '0',
        });

        const updatePromises = players.map(p => p.waitFor('game:vote_update', 3000));
        players[i].socket.emit('game:vote', { answerId, voteType: 'positive' });

        const results = await Promise.all(updatePromises);
        results.forEach(r => {
          expect(r.answerId).toBe(answerId);
          expect(r.positive).toBe(positiveCount);
          expect(r.negative).toBe(0);
        });
      }
    });

    it('oy kaldırma işlemi tüm odaya yayınlanır', async () => {
      const { players: ps } = await setupRoomInVoting(5);
      players = ps;

      const answerId = 600;
      gameService.removeVote.mockResolvedValueOnce(true);
      gamesQueries.getVoteCountsForAnswer.mockResolvedValueOnce({
        positive: '2',
        negative: '1',
      });

      const updatePromises = players.map(p => p.waitFor('game:vote_update', 3000));
      players[0].socket.emit('game:vote', { answerId, voteType: 'remove' });

      const results = await Promise.all(updatePromises);
      results.forEach(r => {
        expect(r.answerId).toBe(answerId);
        expect(r.positive).toBe(2);
        expect(r.negative).toBe(1);
      });
    });
  });

  // ─── 2. Geçersiz Oy Girişleri ────────────────────────────────
  describe('geçersiz oy doğrulamaları', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('negatif answerId ile oy verilince hata döner', async () => {
      const { players: ps } = await setupRoomInVoting(2);
      players = ps;

      const errorPromise = players[0].waitFor('game:error', 3000);
      players[0].socket.emit('game:vote', { answerId: -1, voteType: 'positive' });

      const err = await errorPromise;
      expect(err.message).toBe('Geçersiz cevap ID');
    });

    it('string answerId ile oy verilince hata döner', async () => {
      const { players: ps } = await setupRoomInVoting(2);
      players = ps;

      const errorPromise = players[0].waitFor('game:error', 3000);
      players[0].socket.emit('game:vote', { answerId: 'abc', voteType: 'positive' });

      const err = await errorPromise;
      expect(err.message).toBe('Geçersiz cevap ID');
    });
  });

  // ─── 3. Kanıt Yükleme — 8 Oyuncu ────────────────────────────
  describe('kanıt yükleme (8 oyuncu)', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('görsel yükleme tüm odaya broadcast edilir', async () => {
      const { players: ps } = await setupRoomInVoting(8);
      players = ps;

      const answerId = 300;
      const mockImage = { id: 50, mime_type: 'image/png', image_data: 'data:image/png;base64,abc==' };

      gameService.uploadImage.mockResolvedValueOnce(mockImage);

      const uploadPromises = players.map(p => p.waitFor('game:image_uploaded', 3000));
      players[2].socket.emit('game:upload_image', {
        answerId,
        imageData: 'data:image/png;base64,abc==',
        mimeType: 'image/png',
      });

      const results = await Promise.all(uploadPromises);
      results.forEach(r => {
        expect(r.answerId).toBe(answerId);
        expect(r.imageId).toBe(50);
        expect(r.uploadedBy).toBe(players[2].userId);
        expect(r.imageData).toBe('data:image/png;base64,abc==');
      });
    });

    it('birden fazla oyuncu farklı cevaplara görsel yükler', async () => {
      const { players: ps } = await setupRoomInVoting(8);
      players = ps;

      // 3 oyuncu sırayla farklı cevaplara görsel yükler
      for (let i = 0; i < 3; i++) {
        const answerId = 400 + i;
        const mockImage = { id: 60 + i, mime_type: 'image/jpeg', image_data: `data:image/jpeg;base64,data${i}==` };

        gameService.uploadImage.mockResolvedValueOnce(mockImage);

        const uploadPromises = players.map(p => p.waitFor('game:image_uploaded', 3000));
        players[i].socket.emit('game:upload_image', {
          answerId,
          imageData: `base64data${i}==`,
          mimeType: 'image/jpeg',
        });

        const results = await Promise.all(uploadPromises);
        results.forEach(r => {
          expect(r.answerId).toBe(answerId);
          expect(r.imageId).toBe(60 + i);
          expect(r.uploadedBy).toBe(players[i].userId);
        });
      }
    });

    it('geçersiz answerId ile görsel yükleme hata döner', async () => {
      const { players: ps } = await setupRoomInVoting(2);
      players = ps;

      const errorPromise = players[0].waitFor('game:error', 3000);
      players[0].socket.emit('game:upload_image', {
        answerId: -5,
        imageData: 'data',
        mimeType: 'image/png',
      });

      const err = await errorPromise;
      expect(err.message).toBe('Geçersiz cevap ID');
    });
  });

  // ─── 4. Eş Zamanlı Oylama — 10 Oyuncu ───────────────────────
  describe('eş zamanlı oylama (10 oyuncu)', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('10 oyuncu aynı anda farklı cevaplara oy verir — veri kaybı yok', async () => {
      const { players: ps } = await setupRoomInVoting(10);
      players = ps;

      // Her oyuncu farklı cevaba oy verecek — eş zamanlı
      // Tüm oyuncuların 10 vote_update almasını bekle
      const collectPromises = players.map(p => p.collectEvents('game:vote_update', 10, 5000));

      players.forEach((p, i) => {
        const answerId = 700 + i;
        gameService.submitVote.mockResolvedValueOnce(true);
        gamesQueries.getVoteCountsForAnswer.mockResolvedValueOnce({
          positive: '1',
          negative: '0',
        });
        p.socket.emit('game:vote', { answerId, voteType: 'positive' });
      });

      const allResults = await Promise.all(collectPromises);
      // Her oyuncu 10 update almış olmalı
      allResults.forEach(events => {
        expect(events).toHaveLength(10);
        const answerIds = events.map(e => e.answerId).sort((a, b) => a - b);
        expect(answerIds).toEqual([700, 701, 702, 703, 704, 705, 706, 707, 708, 709]);
      });
    });
  });

  // ─── 5. Oylamayı Bitirme Yetki Kontrolü ──────────────────────
  describe('oylamayı bitirme yetki kontrolü', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('sadece oda sahibi oylamayı bitirebilir — diğerleri hata alır', async () => {
      const { mockRoom, players: ps } = await setupRoomInVoting(5, 20, 300);
      players = ps;

      // Non-owner (players[1]) oylamayı bitirmeye çalışır
      roomsQueries.findById.mockResolvedValueOnce(mockRoom);

      const errorPromise = players[1].waitFor('game:error', 3000);
      players[1].socket.emit('game:end_voting');

      const err = await errorPromise;
      expect(err.message).toBe('Sadece oda sahibi oylamayı bitirebilir');
    });

    it('oda sahibi oylamayı başarıyla bitirir — tüm odaya voting_ended yayınlanır', async () => {
      const { mockRoom, players: ps } = await setupRoomInVoting(5, 21, 400);
      players = ps;

      roomsQueries.findById.mockResolvedValueOnce({ ...mockRoom, id: 21, owner_id: 400 });
      gameService.endVotingPhase.mockResolvedValueOnce({
        result: {
          players: players.map((p, i) => ({
            user_id: p.userId, username: `voter${i + 1}`, round_score: 10 * (5 - i),
          })),
          detailedAnswers: [{ categoryId: 1, answers: [] }],
        },
        isGameOver: false,
        roundId: 100,
      });

      const promises = players.map(p => p.waitFor('game:voting_ended', 3000));
      players[0].socket.emit('game:end_voting');

      const results = await Promise.all(promises);
      results.forEach(r => {
        expect(r.players).toHaveLength(5);
        expect(r.isGameOver).toBe(false);
        expect(r.roundId).toBe(100);
      });
    });
  });

  // ─── 6. 12 Oyunculu Oylama Stres Testi ───────────────────────
  describe('12 oyunculu oylama stres testi', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('12 oyuncu çoklu oy + görsel yükleme ile stres testi', async () => {
      const { players: ps } = await setupRoomInVoting(12, 30, 500);
      players = ps;

      // Her oyuncu 2 farklı cevaba oy verir = 24 oy
      for (let round = 0; round < 2; round++) {
        for (let i = 0; i < 12; i++) {
          const answerId = 800 + round * 100 + i;
          gameService.submitVote.mockResolvedValueOnce(true);
          gamesQueries.getVoteCountsForAnswer.mockResolvedValueOnce({
            positive: String(round + 1),
            negative: '0',
          });

          const updatePromise = players[i].waitFor('game:vote_update', 3000);
          players[i].socket.emit('game:vote', { answerId, voteType: 'positive' });
          await updatePromise;
        }
      }

      // 3 oyuncu görsel yükler
      for (let i = 0; i < 3; i++) {
        const answerId = 1000 + i;
        gameService.uploadImage.mockResolvedValueOnce({ id: 80 + i, mime_type: 'image/png' });

        const uploadPromises = players.map(p => p.waitFor('game:image_uploaded', 3000));
        players[i].socket.emit('game:upload_image', {
          answerId,
          imageData: `data${i}`,
          mimeType: 'image/png',
        });

        const results = await Promise.all(uploadPromises);
        results.forEach(r => {
          expect(r.answerId).toBe(answerId);
          expect(r.imageId).toBe(80 + i);
        });
      }

      // Toplam mock call sayısı doğrulama
      expect(gameService.submitVote).toHaveBeenCalledTimes(24);
      expect(gameService.uploadImage).toHaveBeenCalledTimes(3);
    });
  });
});
