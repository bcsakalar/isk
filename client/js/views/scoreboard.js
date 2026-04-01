// Scoreboard View — Oyun Sonu / Final Skorları + Tur Sonuçları
function ScoreboardView(container, { params }) {
  const code = params.code;
  const unsubscribers = [];
  let eventsSetup = false;

  async function render() {
    // Recovery: Store boşsa (sayfa yenilendi) → server'dan state al
    if (!Store.get('players') || Store.get('players').length === 0) {
      try {
        const res = await Api.get(`/game/recovery/${code}`);
        const state = res.data;

        Store.set('currentRoom', state.room);
        Store.set('currentRound', state.round);
        if (state.players) Store.set('players', state.players);
        if (state.detailedAnswers) Store.set('detailedAnswers', state.detailedAnswers);

        // gameState belirleme
        if (state.phase === 'finished') Store.set('gameState', 'finished');
        else if (state.phase === 'results') Store.set('gameState', 'results');

        // Yanlış phase'deyse doğru view'a yönlendir
        if (state.phase === 'answering') { Router.navigate(`/game/${code}`); return; }
        if (state.phase === 'voting') { Router.navigate(`/voting/${code}`); return; }
        if (state.phase === 'waiting') { Router.navigate(`/room/${code}`); return; }
      } catch (err) {
        console.error('[ScoreboardView] Recovery failed:', err.message);
        Toast.error(err.message || 'Oyun durumu alınamadı');
        Router.navigate('/');
        return;
      }
    }

    const players = Store.get('players') || [];
    const gameState = Store.get('gameState');
    const isFinished = gameState === 'finished';
    const round = Store.get('currentRound');
    const room = Store.get('currentRoom');
    const currentUser = Store.get('user');
    const isOwner = currentUser && room && room.owner_id === currentUser.id;
    const sorted = [...players].sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
    const winner = sorted[0];

    container.innerHTML = `
      <div class="max-w-3xl mx-auto space-y-6">
        ${isFinished ? `
          <!-- Kutlama -->
          <div class="text-center py-8">
            <h1 class="font-pixel text-retro-gold text-xl mb-4">OYUN BİTTİ!</h1>
            ${winner ? `
              <div class="animate-bounce-in">
                <div class="player-avatar w-14 h-14 sm:w-20 sm:h-20 text-xl sm:text-3xl mx-auto border-retro-gold border-4">
                  ${(winner.display_name || winner.username || '?')[0].toUpperCase()}
                </div>
                <h2 class="font-pixel text-retro-accent text-sm mt-4">${escapeHtml(winner.display_name || winner.username || 'Oyuncu')} KAZANDI! 🏆</h2>
                <p class="font-pixel text-retro-gold text-lg mt-2">${winner.total_score || 0} PUAN</p>
              </div>
            ` : ''}
          </div>
        ` : `
          <div class="text-center py-4">
            <h1 class="font-pixel text-retro-accent text-lg">TUR ${round?.round_number || '?'} SONUÇLARI</h1>
          </div>
        `}

        <!-- Skor tablosu -->
        <div class="card-retro p-4">
          <h3 class="font-pixel text-xs text-retro-gold mb-4">${isFinished ? 'FİNAL SKORLARI' : 'GÜNCEL SIRALAMA'}</h3>
          <div class="space-y-2">
            ${sorted.map((p, i) => `
              <div class="leaderboard-row ${i === 0 ? 'border-retro-gold border-2 bg-retro-gold/10' : i === 1 ? 'border-retro-text/30' : i === 2 ? 'border-retro-accent/30' : ''}">
                <div class="flex items-center gap-3">
                  <span class="font-pixel text-lg ${i === 0 ? 'text-retro-gold' : i === 1 ? 'text-retro-text/70' : i === 2 ? 'text-retro-accent/70' : 'text-retro-text/40'}">
                    ${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </span>
                  <div>
                    <p class="font-vt323 text-lg">${escapeHtml(p.display_name || p.username || 'Oyuncu')}</p>
                  </div>
                </div>
                <div class="text-right">
                  <p class="font-pixel text-sm ${i === 0 ? 'text-retro-gold' : 'text-retro-accent'}">${p.total_score || 0}</p>
                  <p class="font-mono text-xs text-retro-text/40">puan</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Kategori Detayları (oylama sonrası) -->
        <div class="card-retro p-4" id="category-details">
          <h3 class="font-pixel text-xs text-retro-gold mb-4">KATEGORİ DETAYLARI</h3>
          <div id="cat-details-content" class="space-y-3"></div>
        </div>

        <!-- Aksiyonlar -->
        <div class="flex flex-col gap-2 sm:flex-row sm:gap-4 sm:justify-center">
          ${isFinished ? `
            <button class="btn-retro" id="btn-back-room">ODAYA DÖN</button>
            <button class="btn-retro-secondary" id="btn-back-lobby">LOBİYE DÖN</button>
            <button class="btn-retro-secondary" id="btn-go-leaderboard">SIRALAMA</button>
          ` : `
            ${isOwner ? '<button class="btn-retro" id="btn-next-round">SONRAKİ TUR →</button>' : '<p class="font-vt323 text-retro-text/50">Oda sahibi sonraki turu başlatacak...</p>'}
            <button class="btn-retro-secondary" id="btn-back-lobby">LOBİYE DÖN</button>
          `}
        </div>
      </div>
    `;

    // Category details
    renderCategoryDetails();

    // Event listeners
    const backRoomBtn = document.getElementById('btn-back-room');
    if (backRoomBtn) backRoomBtn.addEventListener('click', () => {
      backRoomBtn.disabled = true;
      backRoomBtn.textContent = 'BEKLENİYOR...';
      SocketClient.send('room:reset_for_new_game');
      // room:reset event'i setupSocketEvents'te yakalanıp navigate edilecek
      // Fallback: 5 saniye içinde cevap gelmezse yine de navigate et
      setTimeout(() => {
        if (document.getElementById('btn-back-room')) {
          Router.navigate(`/room/${code}`);
        }
      }, 5000);
    });

    const backBtn = document.getElementById('btn-back-lobby');
    if (backBtn) backBtn.addEventListener('click', () => {
      SocketClient.send('room:leave');
      Store.set('currentRoom', null);
      Store.set('currentRound', null);
      Router.navigate('/');
    });

    const leaderBtn = document.getElementById('btn-go-leaderboard');
    if (leaderBtn) leaderBtn.addEventListener('click', () => Router.navigate('/leaderboard'));

    const nextBtn = document.getElementById('btn-next-round');
    if (nextBtn) nextBtn.addEventListener('click', () => {
      SocketClient.send('game:next_round');
      nextBtn.disabled = true;
      nextBtn.textContent = 'BEKLENİYOR...';
    });

    if (!eventsSetup) {
      setupSocketEvents();
      eventsSetup = true;
    }
  }

  function renderCategoryDetails() {
    const el = document.getElementById('cat-details-content');
    if (!el) return;

    const detailedAnswers = Store.get('detailedAnswers') || [];
    if (detailedAnswers.length === 0) {
      el.innerHTML = '<p class="font-vt323 text-retro-text/40 text-sm">Detay bilgisi yok</p>';
      return;
    }

    // Group by category (Map preserves insertion order from server's sort_order)
    const catMap = new Map();
    for (const ans of detailedAnswers) {
      const key = ans.category_id;
      if (!catMap.has(key)) catMap.set(key, { name: ans.category_name, answers: [] });
      catMap.get(key).answers.push(ans);
    }

    el.innerHTML = [...catMap.values()].map(cat => {
      return `
      <div class="border border-retro-accent/20 rounded p-3">
        <div class="mb-2">
          <h4 class="font-pixel text-xs text-retro-gold">${escapeHtml(cat.name)}</h4>
        </div>
        <div class="space-y-1">
          ${cat.answers.map(ans => {
            const isEmpty = !ans.answer || ans.answer.trim() === '';
            const baseScore = ans.base_score || 0;
            const scoreBg = baseScore > 0 ? 'text-emerald-400' : baseScore < 0 ? 'text-red-400' : 'text-retro-text/40';
            const scorePrefix = baseScore > 0 ? '+' : '';
            return `
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="font-vt323 text-sm text-retro-text/70">${escapeHtml(ans.display_name || ans.username || 'Oyuncu')}</span>
                  <span class="font-vt323 text-sm ${isEmpty ? 'text-retro-text/30 italic' : ''}">${isEmpty ? '—' : escapeHtml(ans.answer)}</span>
                  ${ans.is_duplicate ? '<span class="text-xs text-blue-400">(aynı)</span>' : ''}
                </div>
                <span class="font-pixel text-xs ${scoreBg}">${scorePrefix}${baseScore}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
    }).join('');
  }

  function setupSocketEvents() {
    // New round started
    const unsub1 = SocketClient.on('game:new_round', ({ round }) => {
      Store.set('currentRound', round);
      Store.set('gameState', 'playing');
      Store.set('votes', {});
      Router.navigate(`/game/${code}`);
    });

    // Game finished (game:next_round'dan veya direkt)
    const unsub2 = SocketClient.on('game:finished', ({ finalScores }) => {
      Store.set('gameState', 'finished');
      if (finalScores) {
        Store.set('players', finalScores);
      }
      // DOM güncelleme — tam re-render yerine sadece gerekli kısımları güncelle
      const gameState = Store.get('gameState');
      if (gameState === 'finished') {
        render();
      }
    });

    // Room reset (someone clicked "ODAYA DÖN")
    const unsub3 = SocketClient.on('room:reset', (d) => {
      if (d.room) {
        Store.set('currentRoom', d.room);
        Store.set('currentRound', null);
        Store.set('gameState', 'idle');
        Store.set('votes', {});
        Store.set('detailedAnswers', []);
        Router.navigate(`/room/${code}`);
      }
    });

    unsubscribers.push(unsub1, unsub2, unsub3);
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
    },
  };
}

Router.register('/scoreboard/:code', (container, ctx) => {
  if (!Store.get('user')) {
    Router.navigate('/auth');
    return { destroy() {} };
  }
  return ScoreboardView(container, ctx);
});

// Results view (between rounds) uses same component
Router.register('/results/:code', (container, ctx) => {
  if (!Store.get('user')) {
    Router.navigate('/auth');
    return { destroy() {} };
  }
  return ScoreboardView(container, ctx);
});
