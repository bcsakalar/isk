const gamesQueries = require('../db/queries/games.queries');
const roomsQueries = require('../db/queries/rooms.queries');

const scoringService = {
  /**
   * Duplicate cevapları tespit et ve işaretle.
   * Aynı kategori, aynı normalize cevap, farklı oyuncu → is_duplicate = true
   */
  async detectDuplicates(roundId) {
    const allAnswers = await gamesQueries.getAnswersForRound(roundId);
    if (!allAnswers.length) return [];

    // Kategori bazında grupla
    const byCategory = {};
    for (const ans of allAnswers) {
      if (!byCategory[ans.category_id]) byCategory[ans.category_id] = [];
      byCategory[ans.category_id].push(ans);
    }

    const duplicateIds = [];

    for (const answers of Object.values(byCategory)) {
      const normalized = answers.map(a => ({
        ...a,
        norm: a.answer.toLocaleLowerCase('tr-TR').trim().replace(/\s+/g, ' '),
      }));

      for (const ans of normalized) {
        if (!ans.norm || ans.norm.length === 0) continue;

        const sameAnswers = normalized.filter(
          o => o.player_id !== ans.player_id && o.norm === ans.norm && o.norm.length > 0
        );

        if (sameAnswers.length > 0) {
          duplicateIds.push(ans.id);
        }
      }
    }

    return duplicateIds;
  },

  /**
   * Tur başında cevapları ön-puanlama.
   * - Boş cevap: 0 puan, is_valid false
   * - Yanlış harf: 0 puan, is_valid false
   * - Geçerli cevap: is_valid true, is_unique ve is_duplicate set et
   * - Duplicate ve unique cevaplar: base_score = 0, oylama ile puanlanacak
   */
  async prepareRoundForVoting(roundId, letter) {
    const allAnswers = await gamesQueries.getAnswersForRound(roundId);
    if (!allAnswers.length) return [];

    const targetLetter = letter.toLocaleUpperCase('tr-TR');
    const duplicateIds = await this.detectDuplicates(roundId);

    const updates = [];

    for (const ans of allAnswers) {
      const norm = ans.answer.toLocaleLowerCase('tr-TR').trim();
      let isValid = false;
      let isUnique = false;
      let isDuplicate = false;
      let baseScore = 0;

      if (!norm || norm.length === 0) {
        // Boş cevap = 0 puan
      } else if (norm.charAt(0).toLocaleUpperCase('tr-TR') !== targetLetter) {
        // Yanlış harf = 0 puan
      } else {
        isValid = true;
        isDuplicate = duplicateIds.includes(ans.id);
        isUnique = !isDuplicate;

        if (isDuplicate) {
          baseScore = 0; // Duplicate cevaplar oylama ile puanlanacak
        }
      }

      updates.push({
        answerId: ans.id,
        isValid,
        isUnique,
        baseScore,
        voteScore: 0,
        isDuplicate,
      });
    }

    // Tek batch query ile tüm cevapları güncelle
    await gamesQueries.batchUpdateAnswerScores(updates);

    return allAnswers;
  },

  /**
   * Oylama sonuçlarını hesapla ve skorları güncelle.
   * Unique cevaplar: olumlu oy +10, olumsuz oy -10 (min 0)
   * Duplicate cevaplar: olumlu oy +5, olumsuz oy -10 (min 0)
   * Boş/geçersiz cevaplar: 0
   */
  async calculateVoteScores(roundId, roomId) {
    const voteCounts = await gamesQueries.getVoteCountsForRound(roundId);
    const allAnswers = await gamesQueries.getAnswersForRound(roundId);

    const voteMap = {};
    for (const vc of voteCounts) {
      voteMap[vc.answer_id] = vc;
    }

    const playerScores = {}; // playerId -> roundTotal
    const scoreUpdates = [];

    for (const ans of allAnswers) {
      const votes = voteMap[ans.id] || { positive: 0, negative: 0 };
      let baseScore = ans.base_score; // Korunur (invalid: 0)
      let voteScore = 0;

      if (ans.is_valid && ans.is_duplicate) {
        // Duplicate: olumlu oy +5, olumsuz oy -10
        voteScore = (votes.positive * 5) - (votes.negative * 10);
        baseScore = voteScore;
      } else if (ans.is_valid && !ans.is_duplicate) {
        // Unique: olumlu oy +10, olumsuz oy -10
        voteScore = (votes.positive * 10) - (votes.negative * 10);
        baseScore = voteScore;
      }

      scoreUpdates.push({
        answerId: ans.id,
        isValid: ans.is_valid,
        isUnique: ans.is_unique,
        baseScore,
        voteScore,
        isDuplicate: ans.is_duplicate,
      });

      if (!playerScores[ans.player_id]) playerScores[ans.player_id] = 0;
      playerScores[ans.player_id] += baseScore;
    }

    // Batch: tüm cevap skorlarını tek query ile güncelle
    await gamesQueries.batchUpdateAnswerScores(scoreUpdates);

    // Batch: room_players total_score güncelle
    const scoreEntries = Object.entries(playerScores).map(([playerId, score]) => ({
      playerId: parseInt(playerId),
      score,
    }));
    await gamesQueries.batchAddScores(scoreEntries);

    // Sonuçları dön
    const players = await roomsQueries.getPlayers(roomId);
    const detailedAnswers = await gamesQueries.getDetailedAnswersForRound(roundId);

    return {
      players: players
        .map(p => ({
          id: p.id,
          user_id: p.user_id,
          username: p.username,
          display_name: p.display_name,
          total_score: p.total_score,
          round_score: playerScores[p.id] || 0,
        }))
        .sort((a, b) => b.total_score - a.total_score),
      detailedAnswers,
    };
  },
};

module.exports = scoringService;
