// Game View — Cevap Yazma Ekranı (v2 — timer-only, no stop button)
function GameView(container, { params }) {
  const code = params.code;
  let timerComp = null;
  let chatComp = null;
  const unsubscribers = [];

  async function render() {
    // Recovery: Store boşsa (sayfa yenilendi) → server'dan state al
    let room = Store.get('currentRoom');
    let round = Store.get('currentRound');
    let hasSubmitted = false;

    if (!room || !round) {
      try {
        const res = await Api.get(`/game/recovery/${code}`);
        const state = res.data;

        Store.set('currentRoom', state.room);
        Store.set('currentRound', state.round);
        if (state.players) Store.set('players', state.players);

        // Yanlış phase'deyse doğru view'a yönlendir
        if (state.phase === 'voting') { Router.navigate(`/voting/${code}`); return; }
        if (state.phase === 'results') { Router.navigate(`/results/${code}`); return; }
        if (state.phase === 'finished') { Router.navigate(`/scoreboard/${code}`); return; }
        if (state.phase === 'waiting') { Router.navigate(`/room/${code}`); return; }

        room = state.room;
        round = state.round;
        hasSubmitted = state.hasSubmitted || false;
      } catch (err) {
        console.error('[GameView] Recovery failed:', err.message);
        Toast.error(err.message || 'Oyun durumu alınamadı');
        Router.navigate('/');
        return;
      }
    }

    container.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <!-- Sol: Oyun alanı -->
        <div class="lg:col-span-3 space-y-4">
          <!-- Üst bar: Tur bilgisi ve harf -->
          <div class="card-retro p-4">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-4">
                <span class="font-pixel text-xs text-retro-text/50">TUR</span>
                <span class="font-pixel text-lg text-retro-gold" id="round-number">${round?.round_number || 1}</span>
                <span class="font-pixel text-xs text-retro-text/50">/ ${room?.total_rounds || 5}</span>
              </div>
            </div>

            <!-- Harf -->
            <div class="text-center py-6">
              <div class="inline-block">
                <span class="font-pixel text-6xl text-retro-accent animate-bounce-in" id="current-letter">${round?.letter || '?'}</span>
                <p class="font-vt323 text-retro-text/50 mt-2">harfi ile başlayan kelimeler yaz</p>
              </div>
            </div>

            <!-- Timer -->
            <div id="game-timer"></div>
          </div>

          <!-- Cevap Formu -->
          <div class="card-retro p-4" id="answer-section">
            <h3 class="font-pixel text-xs text-retro-gold mb-3">CEVAPLARIN</h3>
            <form id="answer-form" class="space-y-3">
              <div id="answer-fields" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              </div>
              <div class="flex gap-3 mt-4">
                <button type="submit" class="btn-retro flex-1">CEVAPLARI GÖNDER ✓</button>
              </div>
            </form>
          </div>
        </div>

        <!-- Sağ: Chat -->
        <div class="space-y-4">
          <div id="game-chat"></div>
        </div>
      </div>
    `;

    // Timer component
    timerComp = TimerComponent.render(document.getElementById('game-timer'));

    // Chat
    chatComp = ChatComponent.render(document.getElementById('game-chat'), { roomId: code });
    ChatComponent.loadHistory();

    // Build answer fields
    buildAnswerFields();

    // Recovery: cevap zaten gönderilmişse formu devre dışı bırak
    if (hasSubmitted) {
      const form = document.getElementById('answer-form');
      if (form) {
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'GÖNDERİLDİ ✓';
          submitBtn.classList.add('opacity-60');
        }
        form.querySelectorAll('input').forEach(i => { i.disabled = true; });
      }
    }

    // Event listeners
    document.getElementById('answer-form').addEventListener('submit', handleSubmit);

    // Socket events
    setupSocketEvents();
  }

  function buildAnswerFields() {
    const fieldsEl = document.getElementById('answer-fields');
    if (!fieldsEl) return;

    const room = Store.get('currentRoom');
    const round = Store.get('currentRound');
    const letter = round?.letter || '?';
    const categories = room?.categories;
    if (!categories || categories.length === 0) {
      fieldsEl.innerHTML = '<p class="font-vt323 text-retro-text/40 text-center">Kategoriler yüklenemedi. Sayfayı yenileyin.</p>';
      return;
    }

    fieldsEl.innerHTML = categories.map(cat => `
      <div class="card-retro p-3">
        <label class="font-vt323 text-sm text-retro-gold block mb-1">${escapeHtml(cat.name)}</label>
        <input 
          type="text" 
          name="cat_${cat.slug || cat.id}" 
          class="input-retro text-sm py-2 w-full" 
          placeholder="${letter}..." 
          maxlength="100"
          autocomplete="off"
          data-category="${cat.slug || cat.id}"
        />
      </div>
    `).join('');

    // Strict letter enforcement
    fieldsEl.querySelectorAll('input[data-category]').forEach(input => {
      input.addEventListener('input', () => {
        const val = input.value;
        if (val.length > 0) {
          const firstChar = val.charAt(0).toLocaleUpperCase('tr-TR');
          if (firstChar !== letter.toLocaleUpperCase('tr-TR')) {
            input.value = '';
          }
        }
      });
    });

    // Focus first input
    const firstInput = fieldsEl.querySelector('input');
    if (firstInput) firstInput.focus();
  }

  function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const inputs = form.querySelectorAll('[data-category]');
    const answers = {};

    inputs.forEach(input => {
      answers[input.dataset.category] = input.value.trim();
    });

    SocketClient.send('game:submit_answers', { answers });

    // Disable form
    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'GÖNDERİLDİ ✓';
      submitBtn.classList.add('opacity-60');
    }
    inputs.forEach(input => { input.disabled = true; });
  }

  function setupSocketEvents() {
    // Yeni tur
    const unsub1 = SocketClient.on('game:new_round', ({ round }) => {
      Store.set('currentRound', round);
      Store.set('gameState', 'playing');

      const letterEl = document.getElementById('current-letter');
      const roundEl = document.getElementById('round-number');
      const answerSection = document.getElementById('answer-section');

      if (letterEl) {
        letterEl.textContent = round.letter;
        letterEl.className = 'font-pixel text-6xl text-retro-accent animate-bounce-in';
      }
      if (roundEl) roundEl.textContent = round.round_number;
      if (answerSection) answerSection.classList.remove('hidden');

      // Form sıfırla
      const form = document.getElementById('answer-form');
      if (form) {
        form.reset();
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'CEVAPLARI GÖNDER ✓';
          submitBtn.classList.remove('opacity-60');
        }
        form.querySelectorAll('input').forEach(i => { i.disabled = false; });
      }

      TimerComponent.reset();
      buildAnswerFields();
    });

    // Süre bitti — cevapları otomatik gönder
    const unsub7 = SocketClient.on('game:time_up', () => {
      const form = document.getElementById('answer-form');
      if (!form) return;
      const submitBtn = form.querySelector('[type="submit"]');
      // Zaten gönderilmişse tekrar gönderme
      if (submitBtn && submitBtn.disabled) return;

      const inputs = form.querySelectorAll('[data-category]');
      const answers = {};
      inputs.forEach(input => {
        answers[input.dataset.category] = input.value.trim();
      });

      SocketClient.send('game:submit_answers', { answers });

      // Formu devre dışı bırak
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'SÜRE BİTTİ ⏱';
        submitBtn.classList.add('opacity-60');
      }
      inputs.forEach(input => { input.disabled = true; });
      Toast.info('Süre bitti — cevapların otomatik gönderildi');
    });

    // Tur bitti → oylama fazına geçiş
    const unsub3 = SocketClient.on('game:round_ended', ({ detailedAnswers, roundId, voteCounts }) => {
      Store.set('detailedAnswers', detailedAnswers || []);
      Store.set('currentRoundId', roundId);
      Store.set('gameState', 'voting');
      if (voteCounts) Store.set('voteCounts', voteCounts);
      // Oylama ekranına yönlendir
      Router.navigate(`/voting/${code}`);
    });

    // Oyun bitti
    const unsub4 = SocketClient.on('game:finished', ({ finalScores }) => {
      Store.set('gameState', 'finished');
      Router.navigate(`/scoreboard/${code}`);
    });

    // Oyun hatası
    const unsub5 = SocketClient.on('game:error', ({ message }) => {
      Toast.error(message || 'Oyun hatası');
    });

    // Oda hatası (oyun sırasında)
    const unsub6 = SocketClient.on('room:error', ({ message }) => {
      Toast.error(message || 'Bir hata oluştu');
    });

    unsubscribers.push(unsub1, unsub3, unsub4, unsub5, unsub6, unsub7);
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
      if (timerComp) TimerComponent.destroy();
      if (chatComp) ChatComponent.destroy();
    },
  };
}

Router.register('/game/:code', (container, ctx) => {
  if (!Store.get('user')) {
    Router.navigate('/auth');
    return { destroy() {} };
  }
  return GameView(container, ctx);
});
