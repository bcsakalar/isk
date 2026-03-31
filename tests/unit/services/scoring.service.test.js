jest.mock('../../../server/db/queries/games.queries');
jest.mock('../../../server/db/queries/rooms.queries');
jest.mock('../../../server/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

const gamesQueries = require('../../../server/db/queries/games.queries');
const roomsQueries = require('../../../server/db/queries/rooms.queries');
const { getMockRound, getMockAnswer, getMockRoomPlayer } = require('../../helpers/factories');

let scoringService;
beforeAll(() => {
  scoringService = require('../../../server/services/scoring.service');
});

describe('scoringService.detectDuplicates', () => {
  it('boş cevap listesinde duplicate olmamalı', async () => {
    gamesQueries.getAnswersForRound.mockResolvedValue([]);
    const result = await scoringService.detectDuplicates(1);
    expect(result).toEqual([]);
  });

  it('aynı cevapları duplicate olarak işaretlemeli', async () => {
    gamesQueries.getAnswersForRound.mockResolvedValue([
      getMockAnswer({ id: 1, player_id: 1, category_id: 1, answer: 'Ankara' }),
      getMockAnswer({ id: 2, player_id: 2, category_id: 1, answer: 'Ankara' }),
    ]);
    gamesQueries.updateAnswerScore.mockResolvedValue();

    const result = await scoringService.detectDuplicates(1);
    expect(result).toHaveLength(2);
    expect(result).toContain(1);
    expect(result).toContain(2);
  });

  it('farklı cevapları duplicate olarak işaretlememeli', async () => {
    gamesQueries.getAnswersForRound.mockResolvedValue([
      getMockAnswer({ id: 1, player_id: 1, category_id: 1, answer: 'Ankara' }),
      getMockAnswer({ id: 2, player_id: 2, category_id: 1, answer: 'Adana' }),
    ]);

    const result = await scoringService.detectDuplicates(1);
    expect(result).toEqual([]);
  });

  it('Türkçe locale ile büyük/küçük harf eşleştirmeli', async () => {
    gamesQueries.getAnswersForRound.mockResolvedValue([
      getMockAnswer({ id: 1, player_id: 1, category_id: 1, answer: 'İstanbul' }),
      getMockAnswer({ id: 2, player_id: 2, category_id: 1, answer: 'istanbul' }),
    ]);
    gamesQueries.updateAnswerScore.mockResolvedValue();

    const result = await scoringService.detectDuplicates(1);
    expect(result).toHaveLength(2);
  });
});

describe('scoringService.prepareRoundForVoting', () => {
  it('geçersiz cevapları filtrelemeli (yanlış harf)', async () => {
    gamesQueries.getAnswersForRound.mockResolvedValue([
      getMockAnswer({ id: 1, player_id: 1, category_id: 1, answer: 'Berlin' }), // B harfi, A turu
    ]);
    gamesQueries.batchUpdateAnswerScores.mockResolvedValue();

    await scoringService.prepareRoundForVoting(1, 'A');
    expect(gamesQueries.batchUpdateAnswerScores).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ answerId: 1, isValid: false }),
      ])
    );
  });

  it('boş cevaplara 0 puan vermeli', async () => {
    gamesQueries.getAnswersForRound.mockResolvedValue([
      getMockAnswer({ id: 1, player_id: 1, category_id: 1, answer: '' }),
    ]);
    gamesQueries.batchUpdateAnswerScores.mockResolvedValue();

    await scoringService.prepareRoundForVoting(1, 'A');
    expect(gamesQueries.batchUpdateAnswerScores).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ answerId: 1, isValid: false, baseScore: 0 }),
      ])
    );
  });
});

describe('scoringService.calculateVoteScores', () => {
  beforeEach(() => {
    gamesQueries.getAnswersForRound.mockResolvedValue([
      getMockAnswer({ id: 1, player_id: 1, category_id: 1, answer: 'Ankara' }),
      getMockAnswer({ id: 2, player_id: 2, category_id: 1, answer: 'Adana' }),
    ]);
    gamesQueries.getVoteCountsForRound.mockResolvedValue([
      { answer_id: 1, positive: 3, negative: 0 },
      { answer_id: 2, positive: 1, negative: 2 },
    ]);
    gamesQueries.batchUpdateAnswerScores.mockResolvedValue();
    gamesQueries.batchAddScores.mockResolvedValue();
    roomsQueries.getPlayers.mockResolvedValue([
      getMockRoomPlayer({ id: 1, user_id: 1, total_score: 0 }),
      getMockRoomPlayer({ id: 2, user_id: 2, total_score: 0 }),
    ]);
  });

  it('positif oylara +10, negatif oylara -10 puan vermeli', async () => {
    gamesQueries.getDetailedAnswersForRound.mockResolvedValue([]);
    await scoringService.calculateVoteScores(1, 1);

    // Answer 1: 3 positive * 10 - 0 negative * 10 = 30
    // Answer 2: 1 positive * 10 - 2 negative * 10 = -10
    expect(gamesQueries.batchUpdateAnswerScores).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ answerId: 1, voteScore: 30, baseScore: 30 }),
        expect.objectContaining({ answerId: 2, voteScore: -10, baseScore: -10 }),
      ])
    );
    expect(gamesQueries.batchAddScores).toHaveBeenCalled();
  });

  it('negatif oy baskınsa eksi puan vermeli', async () => {
    gamesQueries.getAnswersForRound.mockResolvedValue([
      getMockAnswer({ id: 10, player_id: 1, category_id: 1, answer: 'Ankara', is_valid: true, is_unique: true, is_duplicate: false }),
    ]);
    gamesQueries.getVoteCountsForRound.mockResolvedValue([
      { answer_id: 10, positive: 0, negative: 5 },
    ]);
    gamesQueries.getDetailedAnswersForRound.mockResolvedValue([]);

    await scoringService.calculateVoteScores(1, 1);
    // vote_score = -50, base_score = -50
    expect(gamesQueries.batchUpdateAnswerScores).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ answerId: 10, voteScore: -50, baseScore: -50 }),
      ])
    );
  });

  it('duplicate cevaplar olumlu oy +5, olumsuz oy -10 almalı', async () => {
    gamesQueries.getAnswersForRound.mockResolvedValue([
      getMockAnswer({ id: 20, player_id: 1, category_id: 1, answer: 'Ankara', is_valid: true, is_unique: false, is_duplicate: true, base_score: 0 }),
    ]);
    gamesQueries.getVoteCountsForRound.mockResolvedValue([
      { answer_id: 20, positive: 3, negative: 0 },
    ]);
    gamesQueries.getDetailedAnswersForRound.mockResolvedValue([]);

    await scoringService.calculateVoteScores(1, 1);
    // Duplicate: 3 positive * 5 = 15
    expect(gamesQueries.batchUpdateAnswerScores).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ answerId: 20, voteScore: 15, baseScore: 15 }),
      ])
    );
  });

  it('duplicate cevaplarda olumsuz oy baskınsa eksi puan olmalı', async () => {
    gamesQueries.getAnswersForRound.mockResolvedValue([
      getMockAnswer({ id: 21, player_id: 1, category_id: 1, answer: 'Ankara', is_valid: true, is_unique: false, is_duplicate: true, base_score: 0 }),
    ]);
    gamesQueries.getVoteCountsForRound.mockResolvedValue([
      { answer_id: 21, positive: 1, negative: 2 },
    ]);
    gamesQueries.getDetailedAnswersForRound.mockResolvedValue([]);

    await scoringService.calculateVoteScores(1, 1);
    // Duplicate: 1*5 - 2*10 = -15
    expect(gamesQueries.batchUpdateAnswerScores).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ answerId: 21, voteScore: -15, baseScore: -15 }),
      ])
    );
  });

  it('oy yoksa 0 puan vermeli', async () => {
    gamesQueries.getVoteCountsForRound.mockResolvedValue([]);
    gamesQueries.getDetailedAnswersForRound.mockResolvedValue([]);

    await scoringService.calculateVoteScores(1, 1);
    // Should still batch update answers with 0 vote score
    expect(gamesQueries.batchUpdateAnswerScores).toHaveBeenCalled();
    expect(gamesQueries.batchAddScores).toHaveBeenCalled();
  });

  it('boş/geçersiz cevaplar otomatik red oylarıyla negatif puan almalı', async () => {
    gamesQueries.getAnswersForRound.mockResolvedValue([
      getMockAnswer({ id: 30, player_id: 1, category_id: 1, answer: '', is_valid: false, is_unique: false, is_duplicate: false, base_score: 0 }),
      getMockAnswer({ id: 31, player_id: 2, category_id: 1, answer: 'Ankara', is_valid: true, is_unique: true, is_duplicate: false, base_score: 0 }),
    ]);
    // Boş cevap (id:30) → diğer oyuncudan 1 otomatik negatif oy
    gamesQueries.getVoteCountsForRound.mockResolvedValue([
      { answer_id: 30, positive: 0, negative: 1 },
      { answer_id: 31, positive: 1, negative: 0 },
    ]);
    gamesQueries.getDetailedAnswersForRound.mockResolvedValue([]);
    roomsQueries.getPlayers.mockResolvedValue([
      getMockRoomPlayer({ id: 1, user_id: 1, total_score: 0 }),
      getMockRoomPlayer({ id: 2, user_id: 2, total_score: 0 }),
    ]);

    await scoringService.calculateVoteScores(1, 1);
    // Boş cevap: 0 positive - 1 negative * 10 = -10
    expect(gamesQueries.batchUpdateAnswerScores).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ answerId: 30, voteScore: -10, baseScore: -10 }),
        expect.objectContaining({ answerId: 31, voteScore: 10, baseScore: 10 }),
      ])
    );
  });

  it('boş cevaplar çoklu otomatik red oyuyla daha büyük ceza almalı', async () => {
    gamesQueries.getAnswersForRound.mockResolvedValue([
      getMockAnswer({ id: 40, player_id: 1, category_id: 1, answer: '', is_valid: false, is_unique: false, is_duplicate: false, base_score: 0 }),
    ]);
    // 3 diğer oyuncudan otomatik negatif oy
    gamesQueries.getVoteCountsForRound.mockResolvedValue([
      { answer_id: 40, positive: 0, negative: 3 },
    ]);
    gamesQueries.getDetailedAnswersForRound.mockResolvedValue([]);
    roomsQueries.getPlayers.mockResolvedValue([
      getMockRoomPlayer({ id: 1, user_id: 1, total_score: 0 }),
    ]);

    await scoringService.calculateVoteScores(1, 1);
    // 3 negatif × -10 = -30
    expect(gamesQueries.batchUpdateAnswerScores).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ answerId: 40, voteScore: -30, baseScore: -30 }),
      ])
    );
  });

  it('geçersiz cevap negatif oy yoksa 0 kalmalı', async () => {
    gamesQueries.getAnswersForRound.mockResolvedValue([
      getMockAnswer({ id: 50, player_id: 1, category_id: 1, answer: 'Berlin', is_valid: false, is_unique: false, is_duplicate: false, base_score: 0 }),
    ]);
    // Yanlış harf cevabına hiç oy yok
    gamesQueries.getVoteCountsForRound.mockResolvedValue([]);
    gamesQueries.getDetailedAnswersForRound.mockResolvedValue([]);
    roomsQueries.getPlayers.mockResolvedValue([
      getMockRoomPlayer({ id: 1, user_id: 1, total_score: 0 }),
    ]);

    await scoringService.calculateVoteScores(1, 1);
    expect(gamesQueries.batchUpdateAnswerScores).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ answerId: 50, baseScore: 0, voteScore: 0 }),
      ])
    );
  });

  it('boş cevap cezası playerScores toplamına yansımalı', async () => {
    gamesQueries.getAnswersForRound.mockResolvedValue([
      getMockAnswer({ id: 60, player_id: 1, category_id: 1, answer: '', is_valid: false, is_unique: false, is_duplicate: false, base_score: 0 }),
      getMockAnswer({ id: 61, player_id: 1, category_id: 2, answer: '', is_valid: false, is_unique: false, is_duplicate: false, base_score: 0 }),
    ]);
    // Her iki boş cevaba da 1 negatif oy
    gamesQueries.getVoteCountsForRound.mockResolvedValue([
      { answer_id: 60, positive: 0, negative: 1 },
      { answer_id: 61, positive: 0, negative: 1 },
    ]);
    gamesQueries.getDetailedAnswersForRound.mockResolvedValue([]);
    roomsQueries.getPlayers.mockResolvedValue([
      getMockRoomPlayer({ id: 1, user_id: 1, total_score: 0, username: 'test', display_name: 'Test' }),
    ]);

    const result = await scoringService.calculateVoteScores(1, 1);
    // Player 1: -10 + -10 = -20 toplam tur puanı
    expect(gamesQueries.batchAddScores).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ playerId: 1, score: -20 }),
      ])
    );
    // result.players should reflect round_score
    expect(result.players[0].round_score).toBe(-20);
  });
});
