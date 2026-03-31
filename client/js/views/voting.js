// Voting View — Oylama Fazı
function VotingView(container, { params }) {
  const code = params.code;
  let chatComp = null;
  let currentCatIndex = 0;
  const revealedAnswers = new Set(); // açılmış cevap ID'leri
  const revealConfirmDismissed = new Set(); // "Cevap gösterildi" yazısı gösterilip gizlenmiş ID'ler
  const answerImages = {}; // answerId -> [{ imageId, imageData }]
  let uploadingAnswers = new Set(); // şu an upload edilen cevaplar (çift tıklama önleme)
  const unsubscribers = [];
  let recoveredVotingTimer = null; // recovery'den gelen timer bilgisi

  async function render() {
    // Recovery: Store boşsa (sayfa yenilendi) → server'dan state al
    let round = Store.get('currentRound');
    let room = Store.get('currentRoom');
    const detailedAnswers = Store.get('detailedAnswers') || [];

    if (!room || detailedAnswers.length === 0) {
      try {
        const res = await Api.get(`/game/recovery/${code}`);
        const state = res.data;

        Store.set('currentRoom', state.room);
        if (state.round) Store.set('currentRound', state.round);
        if (state.players) Store.set('players', state.players);

        // Yanlış phase'deyse doğru view'a yönlendir
        if (state.phase === 'answering') { Router.navigate(`/game/${code}`); return; }
        if (state.phase === 'results') { Router.navigate(`/results/${code}`); return; }
        if (state.phase === 'finished') { Router.navigate(`/scoreboard/${code}`); return; }
        if (state.phase === 'waiting') { Router.navigate(`/room/${code}`); return; }

        // Voting state'i Store'a yaz
        if (state.detailedAnswers) Store.set('detailedAnswers', state.detailedAnswers);
        if (state.voteCounts) Store.set('voteCounts', state.voteCounts);
        if (state.userVotes) Store.set('votes', state.userVotes);
        if (state.voteDetails) Store.set('voteDetails', state.voteDetails);
        if (state.votingTimer) recoveredVotingTimer = state.votingTimer;

        // Recovery'den gelen revealed cevapları set'e ekle
        if (state.detailedAnswers) {
          for (const ans of state.detailedAnswers) {
            if (ans.is_revealed) revealedAnswers.add(Number(ans.answer_id));
          }
        }

        // Image metadata'dan görselleri yükle (lazy)
        if (state.imagesMetadata && state.imagesMetadata.length > 0) {
          loadRecoveryImages(state.imagesMetadata);
        }

        room = state.room;
        round = state.round;
      } catch (err) {
        console.error('[VotingView] Recovery failed:', err.message);
        Toast.error(err.message || 'Oylama durumu alınamadı');
        Router.navigate('/');
        return;
      }
    }

    const currentUser = Store.get('user');
    const isOwner = currentUser && room && room.owner_id === currentUser.id;

    container.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <!-- Sol: Oylama alanı -->
        <div class="lg:col-span-3 space-y-4">
          <!-- Üst bar -->
          <div class="card-retro p-4">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-4">
                <span class="font-pixel text-xs text-retro-text/50">TUR</span>
                <span class="font-pixel text-lg text-retro-gold">${round?.round_number || 1}</span>
                <span class="font-pixel text-xs text-retro-text/50">/ ${room?.total_rounds || 5}</span>
                <span class="font-pixel text-4xl text-retro-accent ml-4">${round?.letter || '?'}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="badge-retro bg-retro-purple/20 text-retro-purple border-retro-purple">OYLAMA</span>
                ${isOwner ? '<button id="btn-end-voting" class="btn-retro-secondary text-xs">OYLAMAYI BİTİR</button>' : ''}
              </div>
            </div>

            <!-- Oylama Timer -->
            <div id="voting-timer-bar" class="hidden mb-3">
              <div class="flex items-center justify-between mb-1">
                <span class="font-vt323 text-xs text-retro-text/50">Kalan Süre</span>
                <span class="font-pixel text-xs text-retro-accent" id="voting-timer-text">0</span>
              </div>
              <div class="w-full bg-retro-surface/50 rounded-full h-2">
                <div id="voting-timer-fill" class="bg-retro-accent h-2 rounded-full transition-all duration-1000" style="width: 100%"></div>
              </div>
            </div>

            <!-- Kategori navigasyonu -->
            <div class="flex items-center justify-between">
              <button id="btn-prev-cat" class="btn-retro-outline text-xs px-3 py-1">◀</button>
              <span class="font-pixel text-sm text-retro-gold" id="cat-nav-label">Kategori 1/1</span>
              <button id="btn-next-cat" class="btn-retro-outline text-xs px-3 py-1">▶</button>
            </div>
          </div>

          <!-- Cevap kartları -->
          <div id="vote-cards-container" class="space-y-3"></div>
        </div>

        <!-- Sağ: Chat -->
        <div class="space-y-4">
          <div id="voting-chat"></div>
        </div>
      </div>
    `;

    // Chat
    chatComp = ChatComponent.render(document.getElementById('voting-chat'), { roomId: code });
    ChatComponent.loadHistory();

    // Nav buttons
    document.getElementById('btn-prev-cat').addEventListener('click', () => navigateCategory(-1));
    document.getElementById('btn-next-cat').addEventListener('click', () => navigateCategory(1));

    // End voting
    const endBtn = document.getElementById('btn-end-voting');
    if (endBtn) {
      endBtn.addEventListener('click', () => {
        SocketClient.send('game:end_voting');
      });
    }

    // Render first category
    renderCurrentCategory();
    setupSocketEvents();

    // Recovery: timer bilgisi varsa göster
    if (recoveredVotingTimer && recoveredVotingTimer.remaining > 0) {
      const timerBar = document.getElementById('voting-timer-bar');
      const timerText = document.getElementById('voting-timer-text');
      const timerFill = document.getElementById('voting-timer-fill');
      if (timerBar) timerBar.classList.remove('hidden');
      if (timerText) timerText.textContent = `${recoveredVotingTimer.remaining} sn`;
      if (timerFill) timerFill.style.width = `${(recoveredVotingTimer.remaining / recoveredVotingTimer.total) * 100}%`;
    }
  }

  function loadRecoveryImages(imagesMetadata) {
    // Her image için server'dan data çek (lazy load)
    for (const img of imagesMetadata) {
      const answerId = img.answer_id;
      if (!answerImages[answerId]) answerImages[answerId] = [];

      Api.get(`/game/images/${img.id}`).then(res => {
        if (res.data && res.data.image_data) {
          answerImages[answerId].push({ imageId: img.id, imageData: res.data.image_data });
          renderCurrentCategory();
        }
      }).catch(() => { /* ignore individual image load failures */ });
    }
  }

  function getCategories() {
    const detailedAnswers = Store.get('detailedAnswers') || [];
    const seen = new Set();
    const categories = [];
    for (const ans of detailedAnswers) {
      if (!seen.has(ans.category_id)) {
        seen.add(ans.category_id);
        categories.push({ id: ans.category_id, name: ans.category_name, slug: ans.category_slug });
      }
    }
    return categories;
  }

  function getAnswersForCategory(categoryId) {
    const detailedAnswers = Store.get('detailedAnswers') || [];
    return detailedAnswers.filter(a => a.category_id === categoryId);
  }

  function navigateCategory(dir) {
    const categories = getCategories();
    if (categories.length === 0) return;
    currentCatIndex = Math.max(0, Math.min(categories.length - 1, currentCatIndex + dir));
    renderCurrentCategory();
  }

  function renderCurrentCategory() {
    const categories = getCategories();
    if (categories.length === 0) return;

    const cat = categories[currentCatIndex];
    const answers = getAnswersForCategory(cat.id);
    const currentUser = Store.get('user');
    const room = Store.get('currentRoom');
    const votes = Store.get('votes') || {};
    const voteDetails = Store.get('voteDetails') || {};

    // Update nav label
    const navLabel = document.getElementById('cat-nav-label');
    if (navLabel) navLabel.textContent = `${escapeHtml(cat.name)} — ${currentCatIndex + 1}/${categories.length}`;

    // Update nav button states
    const prevBtn = document.getElementById('btn-prev-cat');
    const nextBtn = document.getElementById('btn-next-cat');
    if (prevBtn) prevBtn.disabled = currentCatIndex === 0;
    if (nextBtn) nextBtn.disabled = currentCatIndex === categories.length - 1;

    const cardsContainer = document.getElementById('vote-cards-container');
    if (!cardsContainer) return;

    cardsContainer.innerHTML = answers.map(ans => {
      const isSelf = currentUser && currentUser.id === ans.user_id;
      const isEmpty = !ans.answer || ans.answer.trim() === '';
      const isDuplicate = ans.is_duplicate;
      const myVote = votes[ans.answer_id];
      const isRevealed = revealedAnswers.has(Number(ans.answer_id));
      const revealMode = room?.answer_reveal_mode || 'direct';
      const isVisible = revealMode === 'direct' ? true : (isSelf || isRevealed);
      const answerText = isEmpty ? '— Cevap Verilmedi —' : (isVisible ? escapeHtml(ans.answer) : '— Cevap Gizli —');
      const answerVotes = voteDetails[ans.answer_id] || [];
      const voteCounts = Store.get('voteCounts') || {};
      const vc = voteCounts[ans.answer_id] || { positive: 0, negative: 0 };
      const net = vc.positive - vc.negative;
      const netText = net >= 0 ? `+${net}` : `${net}`;
      const players = Store.get('players') || [];
      const totalVoters = Math.max(players.length - 1, 0); // cevap sahibi hariç

      return `
        <div class="card-retro p-4" data-answer-id="${ans.answer_id}">
          <div class="flex items-start justify-between gap-4">
            <!-- Oyuncu + Cevap -->
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2">
                <span class="player-avatar text-xs">${(ans.display_name || ans.username || '?')[0].toUpperCase()}</span>
                <span class="font-vt323 text-sm ${isSelf ? 'text-retro-gold' : ''}">${escapeHtml(ans.display_name || ans.username || 'Oyuncu')}</span>
                ${isDuplicate ? '<span class="badge-retro text-xs bg-blue-500/20 text-blue-400 border-blue-400">AYNI</span>' : ''}
                ${isSelf ? '<span class="badge-retro text-xs bg-retro-gold/20 text-retro-gold border-retro-gold">SEN</span>' : ''}
              </div>
              <p class="font-vt323 text-lg ${isEmpty ? 'text-retro-text/30 italic' : !isVisible ? 'text-retro-text/20 italic' : 'text-retro-text'}">${answerText}</p>

              <!-- Cevabı Göster butonu (sadece button modda, kendi cevabında, henüz açılmamışsa) -->
              ${revealMode === 'button' && isSelf && !isEmpty && !isRevealed ? `
                <button class="reveal-btn btn-retro text-xs mt-2" data-answer-id="${ans.answer_id}">CEVABI GÖSTER 👁</button>
              ` : ''}
              ${revealMode === 'button' && isSelf && !isEmpty && isRevealed && !revealConfirmDismissed.has(Number(ans.answer_id)) ? `
                <span class="reveal-confirmed inline-block text-xs text-retro-green mt-2 font-vt323 transition-opacity duration-500">✓ Cevap gösterildi</span>
              ` : ''}

              <!-- Oy kutuları (açık oylama — anonim kutucuklar) -->
              ${totalVoters > 0 ? `
                <div class="flex flex-wrap items-center gap-1.5 mt-2">
                  ${(() => {
                    const positiveCount = vc.positive || 0;
                    const negativeCount = vc.negative || 0;
                    const emptyCount = Math.max(totalVoters - positiveCount - negativeCount, 0);
                    let boxes = '';
                    for (let i = 0; i < positiveCount; i++) {
                      boxes += '<span class="vote-box vote-box-positive inline-flex items-center justify-center w-6 h-6 rounded border-2 border-emerald-400 bg-emerald-500/30 text-emerald-400 text-xs font-bold" title="Olumlu oy">✓</span>';
                    }
                    for (let i = 0; i < negativeCount; i++) {
                      boxes += '<span class="vote-box vote-box-negative inline-flex items-center justify-center w-6 h-6 rounded border-2 border-red-400 bg-red-500/30 text-red-400 text-xs font-bold" title="Olumsuz oy">✗</span>';
                    }
                    for (let i = 0; i < emptyCount; i++) {
                      boxes += '<span class="vote-box vote-box-empty inline-block w-6 h-6 rounded border-2 border-retro-text/15 bg-retro-surface/30"></span>';
                    }
                    return boxes;
                  })()}
                  <span class="font-vt323 text-xs text-retro-text/40 ml-1">${vc.positive + vc.negative}/${totalVoters}</span>
                </div>
              ` : ''}

              <!-- Resimler -->
              <div class="flex items-center gap-1.5 mt-2" id="images-${ans.answer_id}">
                ${(answerImages[ans.answer_id] || []).map(img => `
                  <img src="${img.imageData}" data-image-src="${img.imageData}"
                       class="evidence-thumb w-9 h-9 rounded border border-retro-accent/30
                              object-cover cursor-pointer hover:border-retro-accent hover:scale-110
                              transition-all" title="Kanıt — tıkla büyüt" />
                `).join('')}
                ${!isEmpty && isVisible && (answerImages[ans.answer_id] || []).length < 3 ? `
                  <label class="evidence-upload-btn cursor-pointer inline-flex items-center justify-center
                                w-9 h-9 rounded border border-dashed border-retro-accent/30
                                bg-retro-surface/30 hover:border-retro-accent hover:bg-retro-surface/50
                                transition-all group" title="Kanıt ekle (${3 - (answerImages[ans.answer_id] || []).length} hak)">
                    <span class="text-retro-accent/50 group-hover:text-retro-accent text-sm">📷</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden image-upload-input" data-answer-id="${ans.answer_id}" />
                  </label>
                ` : ''}
                ${!isEmpty && isVisible && (answerImages[ans.answer_id] || []).length >= 3 ? `
                  <span class="text-xs text-retro-text/30 font-vt323 self-center ml-1">3/3</span>
                ` : ''}
              </div>
            </div>

            <!-- Oy butonları (sadece görünür, kendi cevabı olmayan) -->
            ${!isEmpty && !isSelf && isVisible ? `
              <div class="flex flex-col items-center gap-2">
                <button class="vote-btn w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all
                  ${myVote === 'positive' ? 'bg-emerald-500/30 border-emerald-400 text-emerald-400' : 'border-retro-text/20 text-retro-text/40 hover:border-emerald-400 hover:text-emerald-400'}"
                  data-answer-id="${ans.answer_id}" data-vote-type="positive">✓</button>
                <span class="font-pixel text-xs text-retro-text/50 vote-count" data-count-for="${ans.answer_id}">${netText}</span>
                <button class="vote-btn w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all
                  ${myVote === 'negative' ? 'bg-red-500/30 border-red-400 text-red-400' : 'border-retro-text/20 text-retro-text/40 hover:border-red-400 hover:text-red-400'}"
                  data-answer-id="${ans.answer_id}" data-vote-type="negative">✗</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Reveal button handlers (oyuncu kendi cevabını açar)
    cardsContainer.querySelectorAll('.reveal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const answerId = parseInt(btn.dataset.answerId);
        SocketClient.send('game:reveal_answer', { answerId });
      });
    });

    // Vote button handlers
    cardsContainer.querySelectorAll('.vote-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const answerId = parseInt(btn.dataset.answerId);
        const voteType = btn.dataset.voteType;
        const currentVotes = Store.get('votes') || {};

        if (currentVotes[answerId] === voteType) {
          // Remove vote
          SocketClient.send('game:vote', { answerId, voteType: 'remove' });
          delete currentVotes[answerId];
        } else {
          SocketClient.send('game:vote', { answerId, voteType });
          currentVotes[answerId] = voteType;
        }
        Store.set('votes', { ...currentVotes });
        renderCurrentCategory();
      });
    });

    // Image upload handlers
    cardsContainer.querySelectorAll('.image-upload-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const answerId = parseInt(input.dataset.answerId);

        // Çift tıklama / hızlı upload engeli
        if (uploadingAnswers.has(answerId)) {
          Toast.error('Yükleme devam ediyor, lütfen bekleyin');
          input.value = '';
          return;
        }

        // Max 3 kontrol (client-side)
        const existing = answerImages[answerId] || [];
        if (existing.length >= 3) {
          Toast.error('Bu cevaba en fazla 3 kanıt eklenebilir');
          input.value = '';
          return;
        }

        // Boyut kontrol
        if (file.size > 2 * 1024 * 1024) {
          Toast.error('Resim boyutu 2MB\'dan küçük olmalı');
          input.value = '';
          return;
        }

        // Format kontrol
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.type)) {
          Toast.error('Sadece JPG, PNG ve WebP formatları desteklenir');
          input.value = '';
          return;
        }

        uploadingAnswers.add(answerId);
        const reader = new FileReader();
        reader.onload = () => {
          SocketClient.send('game:upload_image', {
            answerId,
            imageData: reader.result,
            mimeType: file.type,
          });
          // Timeout sonrası kilidi kaldır (sunucu yanıt vermezse)
          setTimeout(() => uploadingAnswers.delete(answerId), 10000);
        };
        reader.onerror = () => {
          Toast.error('Dosya okunamadı');
          uploadingAnswers.delete(answerId);
        };
        reader.readAsDataURL(file);
        input.value = '';
      });
    });

    // Evidence thumbnail click → lightbox
    cardsContainer.querySelectorAll('.evidence-thumb').forEach(img => {
      img.addEventListener('click', () => {
        Modal.lightbox(img.dataset.imageSrc);
      });
    });
  }

  function setupSocketEvents() {
    // Vote update (açık oylama — anonim kutucuklar)
    const unsub1 = SocketClient.on('game:vote_update', ({ answerId, positive, negative, voterName, voterUserId, voteType }) => {
      // Oy sayılarını Store'da sakla (re-render sonrası kaybolmasın)
      const voteCounts = Store.get('voteCounts') || {};
      voteCounts[answerId] = { positive: positive || 0, negative: negative || 0 };
      Store.set('voteCounts', { ...voteCounts });

      // Açık oylama detaylarını güncelle (skor hesaplaması için gerekli)
      if (voterName && voteType) {
        const voteDetails = Store.get('voteDetails') || {};
        if (!voteDetails[answerId]) voteDetails[answerId] = [];

        // Mevcut oyu güncelle veya ekle
        const existingIdx = voteDetails[answerId].findIndex(v => v.voter_user_id === voterUserId);
        if (voteType === 'remove') {
          if (existingIdx >= 0) voteDetails[answerId].splice(existingIdx, 1);
        } else if (existingIdx >= 0) {
          voteDetails[answerId][existingIdx].vote_type = voteType;
        } else {
          voteDetails[answerId].push({ voter_user_id: voterUserId, voter_name: voterName, vote_type: voteType });
        }
        Store.set('voteDetails', { ...voteDetails });
      }

      // Her oy güncellemesinde UI'ı yenile (kutucuklar için)
      renderCurrentCategory();

      // Animasyonu sadece oy verilen kartın kutucuklarına uygula
      const votedCard = document.querySelector(`[data-answer-id="${answerId}"]`);
      if (votedCard) {
        votedCard.querySelectorAll('.vote-box-positive, .vote-box-negative').forEach(box => {
          box.classList.add('vote-box-pop');
        });
      }
    });

    // Image uploaded
    const unsub2 = SocketClient.on('game:image_uploaded', ({ answerId, imageId, imageData }) => {
      const key = Number(answerId);
      if (!answerImages[key]) answerImages[key] = [];
      // Duplikat kontrolü
      if (!answerImages[key].some(img => img.imageId === imageId)) {
        answerImages[key].push({ imageId, imageData });
      }
      uploadingAnswers.delete(key);
      renderCurrentCategory();
    });

    // Voting ended → sonuçlar
    const unsub3 = SocketClient.on('game:voting_ended', ({ players, detailedAnswers, roundId, isGameOver }) => {
      Store.set('votes', {});
      Store.set('voteDetails', {});
      Store.set('voteCounts', {});
      Store.set('gameState', isGameOver ? 'finished' : 'results');

      if (players) {
        Store.set('players', players);
      }
      if (detailedAnswers) {
        Store.set('detailedAnswers', detailedAnswers);
      }

      if (isGameOver) {
        Router.navigate(`/scoreboard/${code}`);
      } else {
        Router.navigate(`/results/${code}`);
      }
    });

    // New round (if still on this view)
    const unsub4 = SocketClient.on('game:new_round', ({ round }) => {
      Store.set('currentRound', round);
      Store.set('gameState', 'playing');
      Store.set('votes', {});
      Store.set('voteDetails', {});
      Router.navigate(`/game/${code}`);
    });

    // Bir oyuncunun cevabı açıldı (per-answer reveal)
    const unsub5 = SocketClient.on('game:answer_revealed', ({ answerId }) => {
      revealedAnswers.add(Number(answerId));
      renderCurrentCategory();

      // "Cevap gösterildi" yazısını 3 saniye sonra gizle ve bir daha gösterme
      setTimeout(() => {
        revealConfirmDismissed.add(Number(answerId));
        const confirmEls = document.querySelectorAll('.reveal-confirmed');
        confirmEls.forEach(el => {
          el.style.opacity = '0';
          setTimeout(() => el.remove(), 500);
        });
      }, 3000);
    });

    // Oylama timer
    const unsub6 = SocketClient.on('game:voting_timer', ({ remaining, total }) => {
      const timerBar = document.getElementById('voting-timer-bar');
      const timerText = document.getElementById('voting-timer-text');
      const timerFill = document.getElementById('voting-timer-fill');

      if (timerBar) timerBar.classList.remove('hidden');
      if (timerText) timerText.textContent = `${remaining} sn`;
      if (timerFill) timerFill.style.width = `${(remaining / total) * 100}%`;

      // Renk değiştir
      if (timerFill) {
        if (remaining <= 5) {
          timerFill.className = 'bg-red-500 h-2 rounded-full transition-all duration-1000';
        } else if (remaining <= 15) {
          timerFill.className = 'bg-yellow-500 h-2 rounded-full transition-all duration-1000';
        } else {
          timerFill.className = 'bg-retro-accent h-2 rounded-full transition-all duration-1000';
        }
      }
    });

    // Oylama başladı (süresiz durumda mesaj göster)
    const unsub7 = SocketClient.on('game:voting_started', ({ duration }) => {
      if (!duration || duration === 0) {
        const timerBar = document.getElementById('voting-timer-bar');
        if (timerBar) {
          timerBar.classList.remove('hidden');
          timerBar.innerHTML = '<p class="font-vt323 text-xs text-retro-text/50 text-center">Oda sahibi oylamayı bitirecek...</p>';
        }
      }
    });

    // Oyun/oda hataları
    const unsub8 = SocketClient.on('game:error', ({ message }) => {
      Toast.error(message || 'Oyun hatası');
    });
    const unsub9 = SocketClient.on('room:error', ({ message }) => {
      Toast.error(message || 'Bir hata oluştu');
    });

    unsubscribers.push(unsub1, unsub2, unsub3, unsub4, unsub5, unsub6, unsub7, unsub8, unsub9);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  render();

  return {
    destroy() {
      unsubscribers.forEach(u => u());
      if (chatComp) ChatComponent.destroy();
    },
  };
}

Router.register('/voting/:code', (container, ctx) => {
  if (!Store.get('user')) {
    Router.navigate('/auth');
    return { destroy() {} };
  }
  return VotingView(container, ctx);
});
