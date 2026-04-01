const gameService = require('../../services/game.service');
const roomsQueries = require('../../db/queries/rooms.queries');
const gamesQueries = require('../../db/queries/games.queries');
const { checkEventLimit, clearLimits } = require('../middleware/socketRateLimit');
const logger = require('../../utils/logger');

// Oda bazında zamanlayıcılar
const roomTimers = new Map(); // roomId -> { timer, remaining, duration }
const votingTimers = new Map(); // roomId -> { timer, remaining }
const votingEndInProgress = new Set(); // roomId — race condition önleme
const uploadCooldowns = new Map(); // userId -> lastUploadTime (module scope — reconnection bypass engellemek için)

function gameHandler(io, socket) {
  // Oyunu başlat
  socket.on('game:start', async () => {
    if (!socket.currentRoom) return;

    try {
      const result = await gameService.startGame(socket.currentRoom, socket.user.id);
      const roomKey = `room:${socket.currentRoom}`;

      // Kategorileri de gönder (game form için gerekli)
      const categories = await roomsQueries.getCategories(socket.currentRoom);

      io.to(roomKey).emit('game:started', {
        room: { ...result.room, categories },
        round: result.round,
        players: result.players,
      });

      // Tur zamanlayıcısını başlat
      startRoundTimer(io, socket.currentRoom, result.room.time_per_round);
    } catch (err) {
      socket.emit('game:error', { message: err.message });
    }
  });

  // Cevap gönder
  socket.on('game:submit_answers', async ({ answers }) => {
    if (!socket.currentRoom) return;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return socket.emit('game:error', { message: 'Geçersiz cevap formatı' });
    }

    // DoS koruması: aşırı sayıda key gönderimini engelle
    const answerKeys = Object.keys(answers);
    if (answerKeys.length > 30) {
      return socket.emit('game:error', { message: 'Çok fazla cevap gönderildi' });
    }

    try {
      // Client {slug: answer} formatında gönderir → [{categoryId, answer}] dizisine çevir
      const categories = await roomsQueries.getCategories(socket.currentRoom);
      const answersArray = [];
      for (const [key, value] of Object.entries(answers)) {
        const cat = categories.find(c => c.slug === key || String(c.id) === key);
        if (cat) {
          answersArray.push({ categoryId: cat.id, answer: value });
        }
      }

      await gameService.submitAnswers(socket.currentRoom, socket.user.id, answersArray);
      const roomKey = `room:${socket.currentRoom}`;

      // Diğer oyunculara "birisi cevapladı" bildirimi
      socket.to(roomKey).emit('game:player_submitted', {
        userId: socket.user.id,
        username: socket.user.displayName || socket.user.username,
      });

      socket.emit('game:answers_submitted', { success: true });
    } catch (err) {
      socket.emit('game:error', { message: err.message });
    }
  });

  // Oy gönder (oylama fazında)
  socket.on('game:vote', async ({ answerId, voteType }) => {
    if (!socket.currentRoom) return;
    if (!Number.isInteger(answerId) || answerId <= 0) {
      return socket.emit('game:error', { message: 'Geçersiz cevap ID' });
    }

    try {
      if (voteType === 'remove') {
        await gameService.removeVote(socket.currentRoom, socket.user.id, answerId);
      } else {
        await gameService.submitVote(socket.currentRoom, socket.user.id, answerId, voteType);
      }

      // Güncel oy sayılarını tüm odaya gönder (açık oylama)
      const voteCounts = await gamesQueries.getVoteCountsForAnswer(answerId);
      const roomKey = `room:${socket.currentRoom}`;
      io.to(roomKey).emit('game:vote_update', {
        answerId,
        positive: parseInt(voteCounts.positive) || 0,
        negative: parseInt(voteCounts.negative) || 0,
        voterName: socket.user.displayName || socket.user.username,
        voterUserId: socket.user.id,
        voteType,
      });
    } catch (err) {
      socket.emit('game:error', { message: err.message });
    }
  });

  // Görsel yükle (oylama fazında)
  socket.on('game:upload_image', async ({ answerId, imageData, mimeType }) => {
    if (!socket.currentRoom) return;
    if (!Number.isInteger(answerId) || answerId <= 0) {
      return socket.emit('game:error', { message: 'Geçersiz cevap ID' });
    }

    // Rate limit: aynı kullanıcı 2 saniyede bir yükleyebilir (server-side)
    const now = Date.now();
    const lastUpload = uploadCooldowns.get(socket.user.id) || 0;
    if (now - lastUpload < 2000) {
      return socket.emit('game:error', { message: 'Çok hızlı yükleme yapıyorsunuz, lütfen bekleyin' });
    }

    // Event bazlı rate limit kontrolü
    if (!checkEventLimit(socket.user.id, 'game:upload_image')) {
      return socket.emit('game:error', { message: 'Görsel yükleme limiti aşıldı, lütfen bekleyin' });
    }
    uploadCooldowns.set(socket.user.id, now);

    try {
      const image = await gameService.uploadImage(
        socket.currentRoom, socket.user.id, answerId, imageData, mimeType
      );

      const roomKey = `room:${socket.currentRoom}`;
      io.to(roomKey).emit('game:image_uploaded', {
        answerId,
        imageId: image.id,
        uploadedBy: socket.user.id,
        imageData: image.image_data,
      });
    } catch (err) {
      socket.emit('game:error', { message: err.message });
    }
  });

  // Oylamayı bitir (oda sahibi, manuel)
  socket.on('game:end_voting', async () => {
    if (!socket.currentRoom) return;

    try {
      const room = await roomsQueries.findById(socket.currentRoom);
      if (!room || room.owner_id !== socket.user.id) {
        return socket.emit('game:error', { message: 'Sadece oda sahibi oylamayı bitirebilir' });
      }

      clearVotingTimer(socket.currentRoom);

      // Race condition: timer ile aynı anda çağrılmasını önle
      if (votingEndInProgress.has(socket.currentRoom)) return;
      votingEndInProgress.add(socket.currentRoom);

      try {
        const { result, isGameOver, roundId } = await gameService.endVotingPhase(socket.currentRoom);
        const roomKey = `room:${socket.currentRoom}`;

        io.to(roomKey).emit('game:voting_ended', {
          players: result.players,
          detailedAnswers: result.detailedAnswers,
          roundId,
          isGameOver,
        });
      } finally {
        votingEndInProgress.delete(socket.currentRoom);
      }
    } catch (err) {
      socket.emit('game:error', { message: err.message });
    }
  });

  // Oyuncu kendi cevabını açar (her oyuncu sadece kendi cevabını gösterebilir)
  socket.on('game:reveal_answer', async ({ answerId }) => {
    if (!socket.currentRoom) return;
    if (!Number.isInteger(answerId) || answerId <= 0) {
      return socket.emit('game:error', { message: 'Geçersiz cevap ID' });
    }

    try {
      // Cevabın bu oyuncuya ait olduğunu doğrula
      const player = await roomsQueries.getPlayerByRoomAndUser(socket.currentRoom, socket.user.id);
      if (!player) return socket.emit('game:error', { message: 'Bu odada değilsiniz' });

      const { query: dbQuery } = require('../../config/database');
      const ansResult = await dbQuery(
        'SELECT id, player_id, answer FROM player_answers WHERE id = $1',
        [answerId]
      );
      if (!ansResult.rows[0]) {
        return socket.emit('game:error', { message: 'Cevap bulunamadı' });
      }
      if (ansResult.rows[0].player_id !== player.id) {
        return socket.emit('game:error', { message: 'Sadece kendi cevabını açabilirsin' });
      }

      // DB'de is_revealed olarak işaretle (recovery için)
      await dbQuery('UPDATE player_answers SET is_revealed = TRUE WHERE id = $1', [answerId]);

      const roomKey = `room:${socket.currentRoom}`;
      io.to(roomKey).emit('game:answer_revealed', {
        answerId,
        answer: ansResult.rows[0].answer,
        userId: socket.user.id,
      });
    } catch (err) {
      socket.emit('game:error', { message: err.message });
    }
  });

  // Sonraki tura geç (oda sahibi)
  socket.on('game:next_round', async () => {
    if (!socket.currentRoom) return;

    try {
      const room = await roomsQueries.findById(socket.currentRoom);
      if (!room || room.owner_id !== socket.user.id) return;

      const round = await gameService.startNextRound(socket.currentRoom);
      const roomKey = `room:${socket.currentRoom}`;

      if (!round) {
        // Oyun bitti
        await roomsQueries.setFinished(socket.currentRoom);
        await gameService.finalizeGame(socket.currentRoom);
        const players = await roomsQueries.getPlayers(socket.currentRoom);
        io.to(roomKey).emit('game:finished', {
          finalScores: players.sort((a, b) => b.total_score - a.total_score),
        });
      } else {
        io.to(roomKey).emit('game:new_round', { round });
        startRoundTimer(io, socket.currentRoom, room.time_per_round);
      }
    } catch (err) {
      socket.emit('game:error', { message: err.message });
    }
  });
}

// ─── Round Timer ─────────────────────────────────────────────────
function startRoundTimer(io, roomId, durationSeconds) {
  clearRoomTimer(roomId);

  const roomKey = `room:${roomId}`;
  let remaining = durationSeconds;

  const timer = setInterval(async () => {
    remaining--;

    if (remaining <= 0) {
      clearRoomTimer(roomId);

      // Süre bitti sinyali gönder — client'lar otomatik cevap göndersin
      io.to(roomKey).emit('game:time_up');

      // 1 saniyelik grace period: client'ların cevaplarını göndermesini bekle
      setTimeout(async () => {
        try {
          const round = await gameService.endRound(roomId);
          if (!round) return;

          // Cevapları ve oy sayılarını al (boş cevaplar için otomatik oylar dahil)
          const detailedAnswers = await gamesQueries.getDetailedAnswersForRound(round.id);
          const voteCountsArr = await gamesQueries.getVoteCountsForRound(round.id);
          const voteCounts = {};
          for (const vc of voteCountsArr) {
            voteCounts[vc.answer_id] = { positive: vc.positive, negative: vc.negative };
          }

          io.to(roomKey).emit('game:round_ended', {
            timedOut: true,
            detailedAnswers,
            roundId: round.id,
            voteCounts,
          });

          // Oylama fazını başlat
          const currentRoom = await roomsQueries.findById(roomId);
          const votingDuration = currentRoom?.voting_timer || 0;

          if (votingDuration > 0) {
            startVotingTimer(io, roomId, votingDuration, round.id);
          } else {
            // Süresiz: sadece event gönder, timer yok
            io.to(roomKey).emit('game:voting_started', {
              roundId: round.id,
              duration: 0,
            });
          }
        } catch (err) {
          logger.error('Timer auto-end error', { error: err.message, roomId });
        }
      }, 1000);
      return;
    }

    roomTimers.set(roomId, { timer, remaining, duration: durationSeconds });
    io.to(roomKey).emit('game:timer', { remaining, total: durationSeconds });
  }, 1000);

  roomTimers.set(roomId, { timer, remaining, duration: durationSeconds });
}

function clearRoomTimer(roomId) {
  const entry = roomTimers.get(roomId);
  if (entry) {
    clearInterval(entry.timer);
    roomTimers.delete(roomId);
  }
}

// ─── Voting Timer ────────────────────────────────────────────────
function startVotingTimer(io, roomId, durationSeconds, roundId) {
  clearVotingTimer(roomId);

  const roomKey = `room:${roomId}`;
  let remaining = durationSeconds;

  io.to(roomKey).emit('game:voting_started', {
    duration: durationSeconds,
    roundId,
  });

  const timer = setInterval(async () => {
    remaining--;

    if (remaining <= 0) {
      clearVotingTimer(roomId);

      // Race condition: manuel end_voting ile aynı anda çağrılmasını önle
      if (votingEndInProgress.has(roomId)) return;
      votingEndInProgress.add(roomId);

      // Oylama bitti → skorları hesapla
      try {
        const { result, isGameOver, roundId: rId } = await gameService.endVotingPhase(roomId);

        io.to(roomKey).emit('game:voting_ended', {
          players: result.players,
          detailedAnswers: result.detailedAnswers,
          roundId: rId,
          isGameOver,
        });
      } catch (err) {
        logger.error('Voting finalization error', { error: err.message, roomId });
      } finally {
        votingEndInProgress.delete(roomId);
      }
      return;
    }

    votingTimers.set(roomId, { timer, remaining, duration: durationSeconds, roundId });
    io.to(roomKey).emit('game:voting_timer', { remaining, total: durationSeconds });
  }, 1000);

  votingTimers.set(roomId, { timer, remaining, duration: durationSeconds, roundId });
}

function clearVotingTimer(roomId) {
  const entry = votingTimers.get(roomId);
  if (entry) {
    clearInterval(entry.timer);
    votingTimers.delete(roomId);
  }
}

function clearAllTimers() {
  for (const roomId of roomTimers.keys()) {
    clearRoomTimer(roomId);
  }
  for (const roomId of votingTimers.keys()) {
    clearVotingTimer(roomId);
  }
  uploadCooldowns.clear();
  clearLimits();
}

function getRoomTimerRemaining(roomId) {
  const entry = roomTimers.get(roomId);
  if (!entry) return null;
  return { remaining: entry.remaining, total: entry.duration };
}

function getVotingTimerRemaining(roomId) {
  const entry = votingTimers.get(roomId);
  if (!entry) return null;
  return { remaining: entry.remaining, total: entry.duration };
}

module.exports = { gameHandler, clearRoomTimer, clearVotingTimer, clearAllTimers, getRoomTimerRemaining, getVotingTimerRemaining };
