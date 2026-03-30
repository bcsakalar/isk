const { createSocketTestServer } = require('../helpers/socketTestServer');
const { createPlayerClient, createPlayers, disconnectAll, resetClientCounter } = require('../helpers/socketTestClient');

// ─── Mock DB Queries ─────────────────────────────────────────────
jest.mock('../../server/db/queries/rooms.queries');
jest.mock('../../server/db/queries/games.queries');
jest.mock('../../server/db/queries/users.queries');
jest.mock('../../server/db/queries/admin.queries');

// ─── Mock config/database (room.handler inline require) ─────────
jest.mock('../../server/config/database', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  transaction: jest.fn(),
}));
const database = require('../../server/config/database');

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
// HELPERS — Odaya N oyuncu katılım hazırlığı
// ═════════════════════════════════════════════════════════════════

async function setupRoom(playerCount, roomId = 1, ownerId = 100) {
  const mockRoom = {
    id: roomId, code: 'GAME01', name: 'Oyun Odası', owner_id: ownerId,
    status: 'waiting', max_players: 16, total_rounds: 3, time_per_round: 90, voting_timer: 60,
  };
  const playerMocks = [];
  const players = [];

  for (let i = 0; i < playerCount; i++) {
    const userId = ownerId + i;
    const pMock = { id: i + 1, user_id: userId, username: `player_${i}`, is_ready: true, total_score: 0 };
    playerMocks.push(pMock);

    roomService.joinRoom.mockResolvedValue({ room: mockRoom, player: pMock, alreadyJoined: false });
    roomService.getRoom.mockResolvedValue({ ...mockRoom, players: playerMocks, categories: [{ id: 1, name: 'İsim', slug: 'isim' }, { id: 2, name: 'Şehir', slug: 'sehir' }] });

    const player = await createPlayerClient(port, { id: userId, username: `player_${i}` });
    players.push(player);
    await player.emitAndWait('room:join', { code: 'GAME01' }, 'room:joined');
  }

  return { mockRoom, playerMocks, players };
}

// ═════════════════════════════════════════════════════════════════
// TEST SENARYOLARI
// ═════════════════════════════════════════════════════════════════

describe('Game Lifecycle — E2E Socket Tests', () => {

  // ─── 1. 3 Turlu Tam Oyun — 5 Oyuncu ──────────────────────
  describe('3 turlu tam oyun (5 oyuncu)', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('tam oyun döngüsü: start → cevap → oylama → end_voting → next_round × 3 → finished', async () => {
      const { mockRoom, playerMocks, players: gamePlayers } = await setupRoom(5);
      players = gamePlayers;

      // ─── OYUN BAŞLAT ─────────────────────────────────────
      const mockRound1 = { id: 10, room_id: 1, round_number: 1, letter: 'A' };
      gameService.startGame.mockResolvedValue({
        room: { ...mockRoom, status: 'playing' },
        round: mockRound1,
        players: playerMocks,
      });

      // Tüm oyuncular game:started bekler
      const startedPromises = players.map(p => p.waitFor('game:started', 3000));
      players[0].socket.emit('game:start');

      const startedResults = await Promise.all(startedPromises);
      startedResults.forEach(r => {
        expect(r.round.letter).toBe('A');
        expect(r.players).toHaveLength(5);
      });

      // ─── 3 TUR DÖNGÜSÜ ─────────────────────────────────
      for (let round = 1; round <= 3; round++) {
        const roundId = 10 + round - 1;
        const letter = String.fromCharCode(64 + round); // A, B, C

        // ─── CEVAP GÖNDERİMİ ────────────────────────────
        const categories = [{ id: 1, name: 'İsim', slug: 'isim' }, { id: 2, name: 'Şehir', slug: 'sehir' }];
        roomsQueries.getCategories.mockResolvedValue(categories);
        gameService.submitAnswers.mockResolvedValue({ submitted: 2 });

        // Her oyuncu cevap gönderir
        for (let i = 0; i < 5; i++) {
          const othersSubmitted = players.filter((_, idx) => idx !== i);
          const submittedPromises = othersSubmitted.map(p => p.waitFor('game:player_submitted', 3000));

          players[i].socket.emit('game:submit_answers', {
            answers: { isim: `${letter}hmet`, sehir: `${letter}nkara` },
          });

          // Gönderen oyuncuya answers_submitted gelir
          const ack = await players[i].waitFor('game:answers_submitted', 3000);
          expect(ack.success).toBe(true);

          // Diğerleri player_submitted alır
          const submitted = await Promise.all(submittedPromises);
          submitted.forEach(s => {
            expect(s.userId).toBe(100 + i);
          });
        }

        // ─── TUR SONU (timer simülasyonu — endRound mock) ──
        // Not: Gerçek timer'ı beklemek yerine, game:end_voting ile manüel test ederiz

        // ─── OYLAMA BİTİRME ─────────────────────────────
        const detailedAnswers = playerMocks.map(p => ({
          answer_id: p.id * 10, player_id: p.id, category_id: 1,
          answer: `${letter}hmet`, is_valid: true, base_score: 10,
        }));

        const votingResult = {
          result: { players: playerMocks, detailedAnswers },
          isGameOver: round === 3,
          roundId,
        };

        roomsQueries.findById.mockResolvedValue({ ...mockRoom, owner_id: 100 });
        gameService.endVotingPhase.mockResolvedValue(votingResult);

        const votingEndedPromises = players.map(p => p.waitFor('game:voting_ended', 3000));
        players[0].socket.emit('game:end_voting');

        const votingResults = await Promise.all(votingEndedPromises);
        votingResults.forEach(r => {
          expect(r.players).toHaveLength(5);
          expect(r.isGameOver).toBe(round === 3);
        });

        // ─── SONRAKİ TUR VEYA FİNAL ────────────────────
        if (round < 3) {
          const nextRound = { id: roundId + 1, round_number: round + 1, letter: String.fromCharCode(65 + round) };
          roomsQueries.findById.mockResolvedValue(mockRoom);
          gameService.startNextRound.mockResolvedValue(nextRound);

          const nextRoundPromises = players.map(p => p.waitFor('game:new_round', 3000));
          players[0].socket.emit('game:next_round');

          const nextResults = await Promise.all(nextRoundPromises);
          nextResults.forEach(r => {
            expect(r.round.round_number).toBe(round + 1);
          });
        } else {
          // Son turda game:next_round → startNextRound null → game:finished
          const finalPlayers = playerMocks.map((p, i) => ({ ...p, total_score: (5 - i) * 30 }));
          roomsQueries.findById.mockResolvedValue(mockRoom);
          gameService.startNextRound.mockResolvedValue(null);
          roomsQueries.setFinished.mockResolvedValue();
          gameService.finalizeGame.mockResolvedValue();
          roomsQueries.getPlayers.mockResolvedValue(finalPlayers);

          const finishedPromises = players.map(p => p.waitFor('game:finished', 3000));
          players[0].socket.emit('game:next_round');

          const finishedResults = await Promise.all(finishedPromises);
          const finishedData = finishedResults[0];
          expect(finishedData.finalScores).toBeDefined();
          expect(finishedData.finalScores[0].total_score).toBeGreaterThanOrEqual(finishedData.finalScores[1].total_score);
        }
      }
    });
  });

  // ─── 2. Cevap Göndermeyen Oyuncular — 8 Oyuncu ─────────
  describe('cevap göndermeyen oyuncular (8 oyuncu)', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('3 oyuncunun cevap göndermemesi durumunda diğerleri normal devam eder', async () => {
      const { mockRoom, playerMocks, players: gamePlayers } = await setupRoom(8, 2, 200);
      players = gamePlayers;

      const mockRound = { id: 20, room_id: 2, round_number: 1, letter: 'K' };
      gameService.startGame.mockResolvedValue({
        room: { ...mockRoom, status: 'playing' },
        round: mockRound,
        players: playerMocks,
      });

      const startedPromises = players.map(p => p.waitFor('game:started', 3000));
      players[0].socket.emit('game:start');
      await Promise.all(startedPromises);

      // İlk 5 oyuncu cevap gönderir, son 3 göndermez
      const categories = [{ id: 1, name: 'İsim', slug: 'isim' }, { id: 2, name: 'Şehir', slug: 'sehir' }];
      roomsQueries.getCategories.mockResolvedValue(categories);
      gameService.submitAnswers.mockResolvedValue({ submitted: 2 });

      for (let i = 0; i < 5; i++) {
        players[i].socket.emit('game:submit_answers', {
          answers: { isim: 'Kemal', sehir: 'Konya' },
        });
        await players[i].waitFor('game:answers_submitted', 3000);
      }

      expect(gameService.submitAnswers).toHaveBeenCalledTimes(5);

      // Oylama bitir — tüm oyuncular (8) sonucu görmeli
      const detailedAnswers = playerMocks.map(p => ({
        answer_id: p.id * 10, player_id: p.id, category_id: 1,
        answer: p.id <= 5 ? 'Kemal' : '', is_valid: p.id <= 5, base_score: p.id <= 5 ? 10 : 0,
      }));

      roomsQueries.findById.mockResolvedValue({ ...mockRoom, owner_id: 200 });
      gameService.endVotingPhase.mockResolvedValue({
        result: { players: playerMocks, detailedAnswers },
        isGameOver: false,
        roundId: 20,
      });

      const votingEndedPromises = players.map(p => p.waitFor('game:voting_ended', 3000));
      players[0].socket.emit('game:end_voting');

      const results = await Promise.all(votingEndedPromises);
      results.forEach(r => {
        expect(r.players).toHaveLength(8);
        expect(r.detailedAnswers.length).toBeGreaterThanOrEqual(8);
      });
    });
  });

  // ─── 3. Eş Zamanlı Cevap — 10 Oyuncu ────────────────────
  describe('eş zamanlı cevap gönderimi (10 oyuncu)', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('10 oyuncu aynı anda cevap gönderir, hiçbir cevap kaybolmaz', async () => {
      const { mockRoom, playerMocks, players: gamePlayers } = await setupRoom(10, 3, 300);
      players = gamePlayers;

      const mockRound = { id: 30, room_id: 3, round_number: 1, letter: 'S' };
      gameService.startGame.mockResolvedValue({
        room: { ...mockRoom, status: 'playing' },
        round: mockRound,
        players: playerMocks,
      });

      const startedPromises = players.map(p => p.waitFor('game:started', 3000));
      players[0].socket.emit('game:start');
      await Promise.all(startedPromises);

      const categories = [{ id: 1, name: 'İsim', slug: 'isim' }, { id: 2, name: 'Şehir', slug: 'sehir' }];
      roomsQueries.getCategories.mockResolvedValue(categories);
      gameService.submitAnswers.mockResolvedValue({ submitted: 2 });

      // 10 oyuncu AYNI ANDA cevap gönderir
      const submitPromises = players.map((p, i) => {
        p.socket.emit('game:submit_answers', {
          answers: { isim: `Selim_${i}`, sehir: 'Samsun' },
        });
        return p.waitFor('game:answers_submitted', 5000);
      });

      const acks = await Promise.all(submitPromises);
      acks.forEach(a => expect(a.success).toBe(true));

      // 10 çağrı yapılmış olmalı
      expect(gameService.submitAnswers).toHaveBeenCalledTimes(10);
    });
  });

  // ─── 4. 15 Oyunculu Stres Testi ──────────────────────────
  describe('15 oyunculu büyük oda stres testi', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('15 oyuncu bağlanır, oyun başlar, tüm event\'ler ulaşır', async () => {
      const { mockRoom, playerMocks, players: gamePlayers } = await setupRoom(15, 4, 400);
      players = gamePlayers;

      expect(players).toHaveLength(15);

      const mockRound = { id: 40, room_id: 4, round_number: 1, letter: 'M' };
      gameService.startGame.mockResolvedValue({
        room: { ...mockRoom, status: 'playing' },
        round: mockRound,
        players: playerMocks,
      });

      // Tüm 15 oyuncu game:started almalı
      const startedPromises = players.map(p => p.waitFor('game:started', 5000));
      players[0].socket.emit('game:start');

      const results = await Promise.all(startedPromises);
      expect(results).toHaveLength(15);
      results.forEach(r => {
        expect(r.round.letter).toBe('M');
        expect(r.players).toHaveLength(15);
      });

      // 15 oyuncu aynı anda cevap gönderir
      const categories = [{ id: 1, name: 'İsim', slug: 'isim' }, { id: 2, name: 'Şehir', slug: 'sehir' }];
      roomsQueries.getCategories.mockResolvedValue(categories);
      gameService.submitAnswers.mockResolvedValue({ submitted: 2 });

      const submitPromises = players.map((p, i) => {
        p.socket.emit('game:submit_answers', {
          answers: { isim: `Mehmet_${i}`, sehir: 'Mersin' },
        });
        return p.waitFor('game:answers_submitted', 5000);
      });

      await Promise.all(submitPromises);
      expect(gameService.submitAnswers).toHaveBeenCalledTimes(15);

      // Oylama bitir — 15 oyuncu sonucu almalı
      roomsQueries.findById.mockResolvedValue({ ...mockRoom, owner_id: 400 });
      gameService.endVotingPhase.mockResolvedValue({
        result: { players: playerMocks, detailedAnswers: [] },
        isGameOver: true,
        roundId: 40,
      });
      roomsQueries.getPlayers.mockResolvedValue(
        playerMocks.map((p, i) => ({ ...p, total_score: (15 - i) * 10 }))
      );

      const votingEndedPromises = players.map(p => p.waitFor('game:voting_ended', 5000));
      players[0].socket.emit('game:end_voting');

      const votingResults = await Promise.all(votingEndedPromises);
      expect(votingResults).toHaveLength(15);
      votingResults.forEach(r => {
        expect(r.isGameOver).toBe(true);
      });
    });
  });

  // ─── 5. Validation'lar ────────────────────────────────────
  describe('oyun başlatma doğrulamaları', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('non-owner oyun başlatmaya çalışınca hata alır', async () => {
      const { players: gamePlayers } = await setupRoom(3, 5, 500);
      players = gamePlayers;

      gameService.startGame.mockRejectedValue(new Error('Sadece oda sahibi oyunu başlatabilir'));

      const error = players[1].waitFor('game:error', 3000);
      players[1].socket.emit('game:start');
      const err = await error;
      expect(err.message).toContain('oda sahibi');
    });

    it('tek oyuncu ile oyun başlatılamaz', async () => {
      const { players: gamePlayers } = await setupRoom(1, 6, 600);
      players = gamePlayers;

      gameService.startGame.mockRejectedValue(new Error('Oyun başlatmak için en az 2 oyuncu gerekli'));

      const error = players[0].waitFor('game:error', 3000);
      players[0].socket.emit('game:start');
      const err = await error;
      expect(err.message).toContain('en az 2');
    });
  });

  // ─── 6. Süre Bitince game:time_up Sinyali ────────────────
  describe('süre bitince game:time_up sinyali', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('timer süresi dolunca tüm oyuncular game:time_up alır', async () => {
      const { mockRoom, playerMocks, players: gamePlayers } = await setupRoom(2, 7, 700);
      players = gamePlayers;

      // Oyunu 2 saniyelik süre ile başlat
      const mockRound = { id: 70, room_id: 7, round_number: 1, letter: 'T' };
      gameService.startGame.mockResolvedValue({
        room: { ...mockRoom, status: 'playing', time_per_round: 2 },
        round: mockRound,
        players: playerMocks,
      });

      // endRound, getDetailedAnswersForRound, findById gerekli mock'lar
      gameService.endRound.mockResolvedValue(mockRound);
      gamesQueries.getDetailedAnswersForRound.mockResolvedValue([]);
      roomsQueries.findById.mockResolvedValue({ ...mockRoom, voting_timer: 0 });

      const startedPromises = players.map(p => p.waitFor('game:started', 3000));
      players[0].socket.emit('game:start');
      await Promise.all(startedPromises);

      // game:time_up sinyalini bekle (timer 2 saniye, +1 buffer)
      const timeUpPromises = players.map(p => p.waitFor('game:time_up', 5000));
      const results = await Promise.all(timeUpPromises);
      // game:time_up boş payload gönderir, undefined olabilir
      expect(results).toHaveLength(2);

      // Ardından game:round_ended gelir (2 saniyelik grace period sonrası)
      const roundEndedPromises = players.map(p => p.waitFor('game:round_ended', 5000));
      const roundEndedResults = await Promise.all(roundEndedPromises);
      roundEndedResults.forEach(r => {
        expect(r.timedOut).toBe(true);
        expect(r.roundId).toBe(70);
      });
    });
  });

  // ─── 7. Oyun Sonrası Yeniden Başlatma ────────────────────
  describe('oyun sonrası yeniden başlatma', () => {
    let players = [];

    afterEach(() => {
      disconnectAll(players);
      players = [];
    });

    it('room:reset_for_new_game ile eski veriler temizlenir ve yeni oyun başlar', async () => {
      const { mockRoom, playerMocks, players: gamePlayers } = await setupRoom(2, 8, 800);
      players = gamePlayers;

      // Odayı bitmiş duruma getir
      const finishedRoom = { ...mockRoom, status: 'finished' };
      roomsQueries.findById.mockResolvedValue(finishedRoom);
      roomsQueries.updateStatus.mockResolvedValue();
      database.query.mockResolvedValue({ rows: [] });

      const resetRoom = { ...mockRoom, status: 'waiting', current_round: 0 };
      roomService.getRoom.mockResolvedValue({ ...resetRoom, players: playerMocks, categories: [] });
      roomsQueries.listActive.mockResolvedValue([resetRoom]);

      // Tüm oyuncular room:reset bekler
      const resetPromises = players.map(p => p.waitFor('room:reset', 3000));
      players[0].socket.emit('room:reset_for_new_game');

      const resetResults = await Promise.all(resetPromises);
      resetResults.forEach(r => {
        expect(r.room.status).toBe('waiting');
      });

      // database.query çağrıları doğrula — eski oyun verileri temizlenmeli
      const dbCalls = database.query.mock.calls.map(c => c[0]);
      expect(dbCalls.some(sql => sql.includes('current_round = 0'))).toBe(true);
      expect(dbCalls.some(sql => sql.includes('total_score = 0'))).toBe(true);
      expect(dbCalls.some(sql => sql.includes('DELETE FROM game_rounds'))).toBe(true);

      // Yeni oyun başlatılabilmeli
      const mockRound = { id: 80, room_id: 8, round_number: 1, letter: 'Z' };
      const waitingRoom = { ...mockRoom, status: 'waiting' };
      roomsQueries.findById.mockResolvedValue(waitingRoom);
      gameService.startGame.mockResolvedValue({
        room: { ...waitingRoom, status: 'playing' },
        round: mockRound,
        players: playerMocks,
      });
      roomsQueries.getCategories.mockResolvedValue([{ id: 1, name: 'İsim', slug: 'isim' }]);

      const startedPromises = players.map(p => p.waitFor('game:started', 3000));
      players[0].socket.emit('game:start');

      const startedResults = await Promise.all(startedPromises);
      startedResults.forEach(r => {
        expect(r.round.letter).toBe('Z');
      });
    });
  });
});
