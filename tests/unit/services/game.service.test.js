jest.mock('../../../server/db/queries/games.queries');
jest.mock('../../../server/db/queries/rooms.queries');
jest.mock('../../../server/db/queries/users.queries');
jest.mock('../../../server/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));
jest.mock('../../../server/services/scoring.service', () => ({
  prepareRoundForVoting: jest.fn().mockResolvedValue(),
  calculateVoteScores: jest.fn().mockResolvedValue(),
}));
jest.mock('../../../server/utils/letterPool', () => ({
  pickRandomLetter: jest.fn(() => 'A'),
}));

const gamesQueries = require('../../../server/db/queries/games.queries');
const roomsQueries = require('../../../server/db/queries/rooms.queries');
const usersQueries = require('../../../server/db/queries/users.queries');
const scoringService = require('../../../server/services/scoring.service');
const database = require('../../../server/config/database');
const { getMockRoom, getMockRoomPlayer, getMockRound } = require('../../helpers/factories');

let gameService;
beforeAll(() => {
  gameService = require('../../../server/services/game.service');
});

describe('gameService.startGame', () => {
  const mockRoom = getMockRoom({ id: 1, owner_id: 1, status: 'waiting' });
  const mockPlayers = [
    getMockRoomPlayer({ user_id: 1, level: 1 }),
    getMockRoomPlayer({ user_id: 2, level: 3 }),
  ];

  beforeEach(() => {
    roomsQueries.findById.mockResolvedValue(mockRoom);
    roomsQueries.getPlayers.mockResolvedValue(mockPlayers);
    roomsQueries.setStarted.mockResolvedValue();
    roomsQueries.incrementRound.mockResolvedValue(1);
    gamesQueries.getRoundsByRoom.mockResolvedValue([]);
    gamesQueries.createRound.mockResolvedValue(getMockRound());
  });

  it('owner ve geçerli durumda oyunu başlatmalı', async () => {
    const result = await gameService.startGame(1, 1);
    expect(result.room.status).toBe('playing');
    expect(result.round).toBeDefined();
    expect(result.players).toHaveLength(2);
    expect(roomsQueries.setStarted).toHaveBeenCalledWith(1);
  });

  it('olmayan oda ile NotFoundError fırlatmalı', async () => {
    roomsQueries.findById.mockResolvedValue(null);
    await expect(gameService.startGame(999, 1))
      .rejects.toThrow('Oda bulunamadı');
  });

  it('owner olmayan kullanıcıyı reddetmeli', async () => {
    await expect(gameService.startGame(1, 999))
      .rejects.toThrow('Sadece oda sahibi oyunu başlatabilir');
  });

  it('zaten başlamış oyunu reddetmeli', async () => {
    roomsQueries.findById.mockResolvedValue(getMockRoom({ status: 'playing', owner_id: 1 }));
    await expect(gameService.startGame(1, 1))
      .rejects.toThrow('Oyun zaten başlamış veya bitmiş');
  });

  it('2\'den az oyuncuyu reddetmeli', async () => {
    roomsQueries.getPlayers.mockResolvedValue([getMockRoomPlayer()]);
    await expect(gameService.startGame(1, 1))
      .rejects.toThrow('Oyun başlatmak için en az 2 oyuncu gerekli');
  });
});

describe('gameService.startNextRound', () => {
  beforeEach(() => {
    roomsQueries.findById.mockResolvedValue(getMockRoom({ id: 1, current_round: 0, total_rounds: 5 }));
    roomsQueries.incrementRound.mockResolvedValue(1);
    gamesQueries.getRoundsByRoom.mockResolvedValue([]);
    gamesQueries.createRound.mockResolvedValue(getMockRound({ round_number: 1, letter: 'A' }));
  });

  it('yeni tur oluşturmalı', async () => {
    const round = await gameService.startNextRound(1);
    expect(round).toBeDefined();
    expect(gamesQueries.createRound).toHaveBeenCalled();
  });

  it('tüm turlar bittiğinde null döndürmeli', async () => {
    roomsQueries.findById.mockResolvedValue(getMockRoom({ current_round: 5, total_rounds: 5 }));
    const round = await gameService.startNextRound(1);
    expect(round).toBeNull();
  });

  it('olmayan oda ile hata fırlatmalı', async () => {
    roomsQueries.findById.mockResolvedValue(null);
    await expect(gameService.startNextRound(999))
      .rejects.toThrow('Oda bulunamadı');
  });
});

describe('gameService.submitAnswers', () => {
  beforeEach(() => {
    gamesQueries.getCurrentRound.mockResolvedValue(getMockRound({ id: 1 }));
    roomsQueries.getPlayerByRoomAndUser.mockResolvedValue(getMockRoomPlayer({ id: 10 }));
    gamesQueries.submitAnswer.mockResolvedValue({});
  });

  it('cevapları kaydetmeli', async () => {
    const answers = [
      { categoryId: 1, answer: 'Ankara' },
      { categoryId: 2, answer: 'Ahmet' },
    ];
    const result = await gameService.submitAnswers(1, 1, answers);
    expect(result.submitted).toBe(2);
    expect(gamesQueries.submitAnswer).toHaveBeenCalledTimes(2);
  });

  it('aktif tur yoksa hata fırlatmalı', async () => {
    gamesQueries.getCurrentRound.mockResolvedValue(null);
    await expect(gameService.submitAnswers(1, 1, []))
      .rejects.toThrow('Aktif tur bulunamadı');
  });

  it('odada olmayan oyuncu için hata fırlatmalı', async () => {
    roomsQueries.getPlayerByRoomAndUser.mockResolvedValue(null);
    await expect(gameService.submitAnswers(1, 999, []))
      .rejects.toThrow('Bu odada değilsiniz');
  });

  it('aktif tur yoksa son biten tura grace period içinde cevap kaydetmeli', async () => {
    gamesQueries.getCurrentRound.mockResolvedValue(null);
    gamesQueries.getLatestRound.mockResolvedValue(
      getMockRound({ id: 5, finished_at: new Date() })
    );
    const answers = [{ categoryId: 1, answer: 'Ankara' }];
    const result = await gameService.submitAnswers(1, 1, answers);
    expect(result.submitted).toBe(1);
    expect(gamesQueries.submitAnswer).toHaveBeenCalled();
  });

  it('grace period aşılmışsa hata fırlatmalı', async () => {
    gamesQueries.getCurrentRound.mockResolvedValue(null);
    const oldDate = new Date(Date.now() - 30000); // 30 saniye önce
    gamesQueries.getLatestRound.mockResolvedValue(
      getMockRound({ id: 5, finished_at: oldDate })
    );
    await expect(gameService.submitAnswers(1, 1, [{ categoryId: 1, answer: 'X' }]))
      .rejects.toThrow('Bu tur zaten bitmiş');
  });
});

describe('gameService.endRound', () => {
  beforeEach(() => {
    gamesQueries.getCurrentRound.mockResolvedValue(getMockRound({ id: 1, letter: 'A' }));
    gamesQueries.finishRound.mockResolvedValue();
    gamesQueries.setVotingStarted.mockResolvedValue();
    gamesQueries.submitEmptyAnswersBatch.mockResolvedValue();
    gamesQueries.getAnswersForRound.mockResolvedValue([]);
    roomsQueries.findById.mockResolvedValue(getMockRoom({ current_round: 3, total_rounds: 5 }));
    roomsQueries.getPlayers.mockResolvedValue([
      getMockRoomPlayer({ id: 10, user_id: 1 }),
      getMockRoomPlayer({ id: 11, user_id: 2 }),
    ]);
    roomsQueries.getCategories.mockResolvedValue([
      { id: 1, name: 'İsim', slug: 'isim' },
      { id: 2, name: 'Şehir', slug: 'sehir' },
    ]);
    scoringService.prepareRoundForVoting.mockResolvedValue();
  });

  it('turu bitirip oylama fazına geçmeli', async () => {
    const result = await gameService.endRound(1);
    expect(result).toBeDefined();
    expect(gamesQueries.finishRound).toHaveBeenCalled();
    expect(gamesQueries.setVotingStarted).toHaveBeenCalled();
    expect(scoringService.prepareRoundForVoting).toHaveBeenCalled();
  });

  it('tüm oyuncu×kategori kombolar için boş cevap oluşturmalı', async () => {
    await gameService.endRound(1);
    // 2 oyuncu × 2 kategori = 4 eksik cevap (hiçbiri mevcut değil)
    expect(gamesQueries.submitEmptyAnswersBatch).toHaveBeenCalledWith(1, expect.arrayContaining([
      { playerId: 10, categoryId: 1 },
      { playerId: 10, categoryId: 2 },
      { playerId: 11, categoryId: 1 },
      { playerId: 11, categoryId: 2 },
    ]));
  });

  it('mevcut cevapları ezmemeli', async () => {
    gamesQueries.getAnswersForRound.mockResolvedValue([
      { player_id: 10, category_id: 1, answer: 'Ali' },
      { player_id: 10, category_id: 2, answer: 'Samsun' },
    ]);
    await gameService.endRound(1);
    // Sadece 2 eksik cevap (player 11, cat 1 ve 2)
    expect(gamesQueries.submitEmptyAnswersBatch).toHaveBeenCalledWith(1, expect.arrayContaining([
      { playerId: 11, categoryId: 1 },
      { playerId: 11, categoryId: 2 },
    ]));
    expect(gamesQueries.submitEmptyAnswersBatch).toHaveBeenCalledWith(1, expect.not.arrayContaining([
      expect.objectContaining({ playerId: 10 }),
    ]));
  });
});

describe('gameService.submitVote', () => {
  beforeEach(() => {
    gamesQueries.getCurrentRound.mockResolvedValue(getMockRound({ id: 1 }));
    roomsQueries.getPlayerByRoomAndUser.mockResolvedValue(getMockRoomPlayer({ id: 10, user_id: 1 }));
    database.query.mockResolvedValue({
      rows: [{ player_id: 20 }], // Another player's answer
    });
    gamesQueries.addVote.mockResolvedValue({ id: 1 });
    gamesQueries.getVoteCountsForAnswer.mockResolvedValue({ positive: 1, negative: 0 });
  });

  it('geçerli oy vermeyi kabul etmeli', async () => {
    const result = await gameService.submitVote(1, 1, 5, 'positive');
    expect(result).toBeDefined();
    expect(gamesQueries.addVote).toHaveBeenCalled();
  });

  it('kendi cevabına oy vermeyi reddetmeli', async () => {
    database.query.mockResolvedValue({
      rows: [{ player_id: 10 }], // Own answer (player_id matches)
    });
    await expect(gameService.submitVote(1, 1, 5, 'positive'))
      .rejects.toThrow();
  });
});

describe('gameService.endVotingPhase', () => {
  beforeEach(() => {
    gamesQueries.getCurrentRound.mockResolvedValue(getMockRound({ id: 1 }));
    gamesQueries.setVotingFinished.mockResolvedValue();
    scoringService.calculateVoteScores.mockResolvedValue();
    roomsQueries.findById.mockResolvedValue(getMockRoom({ current_round: 3, total_rounds: 5 }));
    roomsQueries.getPlayers.mockResolvedValue([getMockRoomPlayer()]);
    roomsQueries.setFinished.mockResolvedValue();
    usersQueries.incrementStats.mockResolvedValue();
    gamesQueries.upsertLeaderboard.mockResolvedValue();
  });

  it('oylama fazını bitirip skorları hesaplamalı', async () => {
    const result = await gameService.endVotingPhase(1);
    expect(result).toBeDefined();
    expect(result.isGameOver).toBe(false);
    expect(scoringService.calculateVoteScores).toHaveBeenCalled();
  });

  it('son turda oyunu bitirmeli', async () => {
    roomsQueries.findById.mockResolvedValue(getMockRoom({ current_round: 5, total_rounds: 5 }));
    const result = await gameService.endVotingPhase(1);
    expect(result.isGameOver).toBe(true);
    expect(roomsQueries.setFinished).toHaveBeenCalled();
  });

  it('oylama zaten bitirildiyse tekrar skorlama yapmamalı (idempotency)', async () => {
    gamesQueries.getCurrentRound.mockResolvedValue(
      getMockRound({ id: 1, voting_finished_at: new Date() })
    );
    roomsQueries.findById.mockResolvedValue(getMockRoom({ current_round: 3, total_rounds: 5 }));
    roomsQueries.getPlayers.mockResolvedValue([
      getMockRoomPlayer({ id: 1, user_id: 1, total_score: 30, username: 'test', display_name: 'Test' }),
    ]);
    gamesQueries.getDetailedAnswersForRound.mockResolvedValue([]);

    const result = await gameService.endVotingPhase(1);
    expect(result.isGameOver).toBe(false);
    expect(scoringService.calculateVoteScores).not.toHaveBeenCalled();
    expect(gamesQueries.setVotingFinished).not.toHaveBeenCalled();
  });
});
