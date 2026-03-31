const gamesQueries = require('../db/queries/games.queries');
const roomsQueries = require('../db/queries/rooms.queries');
const usersQueries = require('../db/queries/users.queries');
const scoringService = require('./scoring.service');
const { pickRandomLetter } = require('../utils/letterPool');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');
const logger = require('../utils/logger');

const gameService = {
  async startGame(roomId, userId) {
    const room = await roomsQueries.findById(roomId);
    if (!room) throw new NotFoundError('Oda bulunamadı');
    if (room.owner_id !== userId) throw new BadRequestError('Sadece oda sahibi oyunu başlatabilir');
    if (room.status !== 'waiting') throw new BadRequestError('Oyun zaten başlamış veya bitmiş');

    const players = await roomsQueries.getPlayers(roomId);
    if (players.length < 2) throw new BadRequestError('Oyun başlatmak için en az 2 oyuncu gerekli');

    await roomsQueries.setStarted(roomId);

    // İlk turu başlat
    const round = await this.startNextRound(roomId);
    return { room: { ...room, status: 'playing' }, round, players };
  },

  async startNextRound(roomId) {
    const room = await roomsQueries.findById(roomId);
    if (!room) throw new NotFoundError('Oda bulunamadı');

    const newRoundNumber = room.current_round + 1;
    if (newRoundNumber > room.total_rounds) {
      return null; // Oyun bitti
    }

    // Daha önce kullanılan harfleri al
    const previousRounds = await gamesQueries.getRoundsByRoom(roomId);
    const usedLetters = previousRounds.map(r => r.letter);

    // Harf havuzu tükenme kontrolü
    const enabledLetters = room.enabled_letters || null;
    let pool;
    if (enabledLetters) {
      pool = enabledLetters.split(',').map(l => l.trim().toLocaleUpperCase('tr-TR'));
    } else {
      pool = null; // Tam havuz kullanılacak (29 harf)
    }
    const availableCount = pool
      ? pool.filter(l => !usedLetters.includes(l)).length
      : 29 - usedLetters.filter((l, i, a) => a.indexOf(l) === i).length;

    const poolReset = availableCount <= 0;
    if (poolReset) {
      logger.warn('Letter pool exhausted, resetting pool', {
        roomId,
        roundNumber: newRoundNumber,
        usedLetters,
      });
    }

    // Harf seç — enabled_letters varsa onlardan, yoksa tüm havuzdan
    const letter = pickRandomLetter(usedLetters, enabledLetters);

    await roomsQueries.incrementRound(roomId);

    const round = await gamesQueries.createRound({
      roomId,
      roundNumber: newRoundNumber,
      letter,
    });

    // usedLetters'a yeni harfi ekle (client'a gönderilmek üzere)
    round.usedLetters = [...usedLetters, letter];
    round.poolReset = poolReset;

    return round;
  },

  async submitAnswers(roomId, userId, answers) {
    // answers = [{ categoryId, answer }]
    // Önce aktif turu dene, yoksa son turu al (süre bitti grace period)
    let round = await gamesQueries.getCurrentRound(roomId);
    if (!round) {
      round = await gamesQueries.getLatestRound(roomId);
      // Grace period: son 10 saniye içinde bitmiş turlar kabul edilir
      if (!round || !round.finished_at) throw new BadRequestError('Aktif tur bulunamadı');
      const finishedAgo = Date.now() - new Date(round.finished_at).getTime();
      if (finishedAgo > 10000) throw new BadRequestError('Bu tur zaten bitmiş');
    }

    const player = await roomsQueries.getPlayerByRoomAndUser(roomId, userId);
    if (!player) throw new BadRequestError('Bu odada değilsiniz');

    // Doğru harf kontrolü
    const targetLetter = round.letter.toLocaleUpperCase('tr-TR');

    for (const ans of answers) {
      const sanitizedAnswer = (ans.answer || '').trim();
      await gamesQueries.submitAnswer({
        roundId: round.id,
        playerId: player.id,
        categoryId: ans.categoryId,
        answer: sanitizedAnswer,
      });
    }

    return { submitted: answers.length };
  },

  /**
   * Tur sonu — sadece timer tarafından çağrılır (STOP butonu yok).
   * Cevapları ön-puanla, oylama fazına geç.
   */
  async endRound(roomId) {
    const round = await gamesQueries.getCurrentRound(roomId);
    if (!round) throw new BadRequestError('Aktif tur bulunamadı');

    // Cevap vermeyen oyuncular için boş kayıt oluştur (batch — tek INSERT)
    const players = await roomsQueries.getPlayers(roomId);
    const categories = await roomsQueries.getCategories(roomId);
    const existingAnswers = await gamesQueries.getAnswersForRound(round.id);
    const existingSet = new Set(
      existingAnswers.map(a => `${a.player_id}:${a.category_id}`)
    );

    const missingEntries = [];
    for (const player of players) {
      for (const cat of categories) {
        if (!existingSet.has(`${player.id}:${cat.id}`)) {
          missingEntries.push({ playerId: player.id, categoryId: cat.id });
        }
      }
    }

    if (missingEntries.length > 0) {
      await gamesQueries.submitEmptyAnswersBatch(round.id, missingEntries);
    }

    await gamesQueries.finishRound(round.id);

    // Duplicate tespiti ve ön-puanlama yap (batch)
    await scoringService.prepareRoundForVoting(round.id, round.letter);

    // Boş cevaplara otomatik olumsuz oy ekle (tüm diğer oyunculardan)
    const allAnswersAfterPrep = await gamesQueries.getAnswersForRound(round.id);
    const emptyAnswers = allAnswersAfterPrep.filter(a => !a.answer || a.answer.trim() === '');
    if (emptyAnswers.length > 0) {
      const autoVoteEntries = [];
      for (const emptyAns of emptyAnswers) {
        for (const player of players) {
          if (player.id !== emptyAns.player_id) {
            autoVoteEntries.push({ answerId: emptyAns.id, voterId: player.id });
          }
        }
      }
      if (autoVoteEntries.length > 0) {
        await gamesQueries.addAutoNegativeVotesBatch(autoVoteEntries);
        logger.info('Auto-negative votes inserted for empty answers', {
          roomId, roundId: round.id, emptyCount: emptyAnswers.length, voteCount: autoVoteEntries.length,
        });
      }
    }

    // Oylama başlangıcını kaydet
    await gamesQueries.setVotingStarted(round.id);

    return round;
  },

  /**
   * Oylama gönder
   */
  async submitVote(roomId, userId, answerId, voteType) {
    const player = await roomsQueries.getPlayerByRoomAndUser(roomId, userId);
    if (!player) throw new BadRequestError('Bu odada değilsiniz');

    if (!['positive', 'negative'].includes(voteType)) {
      throw new BadRequestError('Geçersiz oy tipi');
    }

    // Kendi cevabına oy veremez
    const { query: dbQuery } = require('../config/database');
    const answerResult = await dbQuery('SELECT player_id FROM player_answers WHERE id = $1', [answerId]);
    if (!answerResult.rows[0]) throw new BadRequestError('Cevap bulunamadı');
    if (answerResult.rows[0].player_id === player.id) {
      throw new BadRequestError('Kendi cevabına oy veremezsin');
    }

    await gamesQueries.addVote(answerId, player.id, voteType);
    return { success: true };
  },

  /**
   * Oy kaldır
   */
  async removeVote(roomId, userId, answerId) {
    const player = await roomsQueries.getPlayerByRoomAndUser(roomId, userId);
    if (!player) throw new BadRequestError('Bu odada değilsiniz');
    await gamesQueries.removeVote(answerId, player.id);
    return { success: true };
  },

  /**
   * Görsel yükle (base64)
   */
  async uploadImage(roomId, userId, answerId, imageData, mimeType) {
    const player = await roomsQueries.getPlayerByRoomAndUser(roomId, userId);
    if (!player) throw new BadRequestError('Bu odada değilsiniz');

    // Boyut kontrolü — ~2MB base64 ≈ 2.7M karakter
    if (!imageData || imageData.length > 2800000) {
      throw new BadRequestError('Görsel çok büyük (max 2MB)');
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(mimeType)) {
      throw new BadRequestError('Geçersiz görsel formatı');
    }

    // Base64 formatı doğrula
    if (!imageData.startsWith('data:image/')) {
      throw new BadRequestError('Geçersiz görsel verisi');
    }

    const image = await gamesQueries.addImage(answerId, player.id, imageData, mimeType);
    if (!image) {
      throw new BadRequestError('Bu cevaba en fazla 3 kanıt eklenebilir');
    }
    return { ...image, image_data: imageData };
  },

  /**
   * Oylama fazını bitir ve skorları hesapla
   */
  async endVotingPhase(roomId) {
    const round = await gamesQueries.getCurrentRound(roomId);
    if (!round) {
      // getCurrentRound finished_at NULL olan arıyor, voting sırasında finished_at set
      // direkt en son round'u al
      const rounds = await gamesQueries.getRoundsByRoom(roomId);
      const room = await roomsQueries.findById(roomId);
      const lastRound = rounds.find(r => r.round_number === room.current_round);
      if (!lastRound) throw new BadRequestError('Tur bulunamadı');

      // Idempotency: oylama zaten bitirildiyse tekrar skorlama yapma
      if (lastRound.voting_finished_at) {
        const players = await roomsQueries.getPlayers(roomId);
        const detailedAnswers = await gamesQueries.getDetailedAnswersForRound(lastRound.id);
        const isGameOver = room.current_round >= room.total_rounds;
        return {
          result: {
            players: players
              .map(p => ({ id: p.id, user_id: p.user_id, username: p.username, display_name: p.display_name, total_score: p.total_score, round_score: 0 }))
              .sort((a, b) => b.total_score - a.total_score),
            detailedAnswers,
          },
          isGameOver,
          roundId: lastRound.id,
        };
      }

      await gamesQueries.setVotingFinished(lastRound.id);
      const result = await scoringService.calculateVoteScores(lastRound.id, roomId);

      const isGameOver = room.current_round >= room.total_rounds;
      if (isGameOver) {
        await roomsQueries.setFinished(roomId);
        await this.finalizeGame(roomId);
      }

      return { result, isGameOver, roundId: lastRound.id };
    }

    // Idempotency: oylama zaten bitirildiyse tekrar skorlama yapma
    if (round.voting_finished_at) {
      const room = await roomsQueries.findById(roomId);
      const players = await roomsQueries.getPlayers(roomId);
      const detailedAnswers = await gamesQueries.getDetailedAnswersForRound(round.id);
      const isGameOver = room.current_round >= room.total_rounds;
      return {
        result: {
          players: players
            .map(p => ({ id: p.id, user_id: p.user_id, username: p.username, display_name: p.display_name, total_score: p.total_score, round_score: 0 }))
            .sort((a, b) => b.total_score - a.total_score),
          detailedAnswers,
        },
        isGameOver,
        roundId: round.id,
      };
    }

    await gamesQueries.setVotingFinished(round.id);
    const result = await scoringService.calculateVoteScores(round.id, roomId);

    const room = await roomsQueries.findById(roomId);
    const isGameOver = room.current_round >= room.total_rounds;
    if (isGameOver) {
      await roomsQueries.setFinished(roomId);
      await this.finalizeGame(roomId);
    }

    return { result, isGameOver, roundId: round.id };
  },

  async finalizeGame(roomId) {
    const players = await roomsQueries.getPlayers(roomId);
    if (!players.length) return;

    // Sıralama
    const sorted = [...players].sort((a, b) => b.total_score - a.total_score);
    const winnerId = sorted[0].user_id;

    // Sezon bilgisi
    const now = new Date();
    const weekNum = Math.ceil(((now - new Date(now.getFullYear(), 0, 1)) / 86400000 + 1) / 7);
    const weeklySeason = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    const monthlySeason = `${now.getFullYear()}-M${String(now.getMonth() + 1).padStart(2, '0')}`;

    for (const player of sorted) {
      const isWinner = player.user_id === winnerId;
      const xp = player.total_score + (isWinner ? 50 : 10);

      // Misafir kullanıcılar için istatistik ve liderlik tablosu güncellemesi yapma
      const playerUser = await usersQueries.findById(player.user_id);
      if (playerUser && playerUser.is_guest) continue;

      await usersQueries.incrementStats(player.user_id, {
        xp,
        wins: isWinner ? 1 : 0,
        games: 1,
      });

      // Liderlik tablosu güncelle
      await gamesQueries.upsertLeaderboard({
        userId: player.user_id,
        season: weeklySeason,
        periodType: 'weekly',
        score: player.total_score,
        wins: isWinner ? 1 : 0,
        gamesPlayed: 1,
      });
      await gamesQueries.upsertLeaderboard({
        userId: player.user_id,
        season: monthlySeason,
        periodType: 'monthly',
        score: player.total_score,
        wins: isWinner ? 1 : 0,
        gamesPlayed: 1,
      });
    }
  },

  async getRecoveryState(code, userId) {
    const room = await roomsQueries.findByCode(code);
    if (!room) throw new NotFoundError('Oda bulunamadı');

    // Oyuncu bu odada mı kontrol et (bitmiş odalarda left_at set olmuş olabilir)
    const player = room.status === 'finished'
      ? await roomsQueries.getPlayerByRoomAndUserIncludeLeft(room.id, userId)
      : await roomsQueries.getPlayerByRoomAndUser(room.id, userId);
    if (!player) throw new ForbiddenError('Bu odada değilsiniz');

    const players = await roomsQueries.getPlayers(room.id);
    const categories = await roomsQueries.getCategories(room.id);
    const { password_hash, ...safeRoom } = room;
    const roomData = { ...safeRoom, has_password: !!password_hash, categories };

    // Oda bekleme durumunda
    if (room.status === 'waiting') {
      return { phase: 'waiting', room: roomData, players };
    }

    // Oda bitmiş
    if (room.status === 'finished') {
      const latestRound = await gamesQueries.getLatestRound(room.id);
      let detailedAnswers = [];
      if (latestRound) {
        detailedAnswers = await gamesQueries.getDetailedAnswersForRound(latestRound.id);
      }
      return { phase: 'finished', room: roomData, players, round: latestRound, detailedAnswers };
    }

    // Oyun devam ediyor (status === 'playing')
    const currentRound = await gamesQueries.getCurrentRound(room.id);

    if (currentRound) {
      // Aktif round mevcut (finished_at IS NULL)
      if (!currentRound.voting_started_at) {
        // Cevap yazma fazı
        // Lazy require to avoid circular dependency
        const { getRoomTimerRemaining } = require('../socket/handlers/game.handler');
        const timer = getRoomTimerRemaining(room.id);

        // Kullanıcı cevap göndermiş mi?
        const playerAnswers = await gamesQueries.getPlayerAnswersForRound(currentRound.id, player.id);
        const hasSubmitted = playerAnswers.length > 0;

        return {
          phase: 'answering',
          room: roomData,
          players,
          round: currentRound,
          timer,
          hasSubmitted,
        };
      }

      // voting_started_at SET ama voting_finished_at NULL → Oylama fazı
      if (!currentRound.voting_finished_at) {
        const { getVotingTimerRemaining } = require('../socket/handlers/game.handler');
        const votingTimer = getVotingTimerRemaining(room.id);
        const detailedAnswers = await gamesQueries.getDetailedAnswersForRound(currentRound.id);
        const voteCounts = await gamesQueries.getVoteCountsForRound(currentRound.id);
        const allVotes = await gamesQueries.getVotesWithNamesForRound(currentRound.id);
        const imagesMetadata = await gamesQueries.getImagesForRound(currentRound.id);

        // Kullanıcının kendi oylarını ayır
        const userVotes = {};
        const voteDetails = {};
        for (const v of allVotes) {
          if (v.voter_user_id === userId) {
            userVotes[v.answer_id] = v.vote_type;
          }
          if (!voteDetails[v.answer_id]) voteDetails[v.answer_id] = [];
          voteDetails[v.answer_id].push({
            voter_user_id: v.voter_user_id,
            voter_name: v.voter_name,
            vote_type: v.vote_type,
          });
        }

        // voteCounts → answerId-indexed object
        const voteCountsMap = {};
        for (const vc of voteCounts) {
          voteCountsMap[vc.answer_id] = { positive: vc.positive, negative: vc.negative };
        }

        return {
          phase: 'voting',
          room: roomData,
          players,
          round: currentRound,
          detailedAnswers,
          voteCounts: voteCountsMap,
          userVotes,
          voteDetails,
          imagesMetadata,
          votingTimer,
        };
      }
    }

    // getCurrentRound null → finished_at zaten set edilmiş, latestRound'dan devam et
    // NOT: endRound() → finishRound() çağrısı finished_at'ı set eder,
    // ardından setVotingStarted() çağrılır. Bu yüzden oylama fazında
    // getCurrentRound() null döner (finished_at IS NULL sorgusundan dolayı).
    const latestRound = await gamesQueries.getLatestRound(room.id);
    if (latestRound) {
      // Oylama aktif: voting_started_at SET, voting_finished_at NULL
      if (latestRound.voting_started_at && !latestRound.voting_finished_at) {
        const { getVotingTimerRemaining } = require('../socket/handlers/game.handler');
        const votingTimer = getVotingTimerRemaining(room.id);
        const detailedAnswers = await gamesQueries.getDetailedAnswersForRound(latestRound.id);
        const voteCounts = await gamesQueries.getVoteCountsForRound(latestRound.id);
        const allVotes = await gamesQueries.getVotesWithNamesForRound(latestRound.id);
        const imagesMetadata = await gamesQueries.getImagesForRound(latestRound.id);

        const userVotes = {};
        const voteDetails = {};
        for (const v of allVotes) {
          if (v.voter_user_id === userId) {
            userVotes[v.answer_id] = v.vote_type;
          }
          if (!voteDetails[v.answer_id]) voteDetails[v.answer_id] = [];
          voteDetails[v.answer_id].push({
            voter_user_id: v.voter_user_id,
            voter_name: v.voter_name,
            vote_type: v.vote_type,
          });
        }

        const voteCountsMap = {};
        for (const vc of voteCounts) {
          voteCountsMap[vc.answer_id] = { positive: vc.positive, negative: vc.negative };
        }

        return {
          phase: 'voting',
          room: roomData,
          players,
          round: latestRound,
          detailedAnswers,
          voteCounts: voteCountsMap,
          userVotes,
          voteDetails,
          imagesMetadata,
          votingTimer,
        };
      }

      // Sonuçlar fazı: voting_finished_at SET
      if (latestRound.voting_finished_at) {
        const detailedAnswers = await gamesQueries.getDetailedAnswersForRound(latestRound.id);
        return {
          phase: 'results',
          room: roomData,
          players,
          round: latestRound,
          detailedAnswers,
        };
      }
    }

    // Fallback: belirsiz durum → waiting olarak dön
    return { phase: 'waiting', room: roomData, players };
  },
};

module.exports = gameService;
