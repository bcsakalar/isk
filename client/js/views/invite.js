// Invite View — Davet Linki ile Odaya Katılma
function InviteView(container, { params }) {
  const code = params.code;
  let roomData = null;
  let pollInterval = null;

  function formatVotingTimer(val) {
    return val ? val + 's' : 'Süresiz';
  }

  function formatRevealMode(mode) {
    return mode === 'button' ? 'Butonla' : 'Direkt';
  }

  async function render() {
    container.innerHTML = `
      <div class="max-w-md mx-auto mt-12">
        <div class="card-retro p-6 text-center">
          <div class="animate-pulse font-pixel text-retro-accent text-sm">Oda bilgileri yükleniyor...</div>
        </div>
      </div>
    `;

    try {
      const res = await Api.get(`/rooms/preview/${code}`);
      roomData = res.data;

      // Oda artık aktif değilse
      if (roomData.status === 'abandoned' || roomData.status === 'finished') {
        renderInactive();
        return;
      }

      renderInvite();
      startPolling();
    } catch (err) {
      console.warn('Room preview failed:', err.message);
      container.innerHTML = `
        <div class="max-w-md mx-auto mt-12">
          <div class="card-retro p-6 text-center space-y-4">
            <h1 class="font-pixel text-red-400 text-sm">ODA BULUNAMADI</h1>
            <p class="font-vt323 text-retro-text/50">Bu davet linki geçersiz veya oda artık mevcut değil.</p>
            <button class="btn-retro" id="btn-go-home">ANA SAYFAYA DÖN</button>
          </div>
        </div>
      `;
      const homeBtn = document.getElementById('btn-go-home');
      if (homeBtn) homeBtn.addEventListener('click', () => Router.navigate('/'));
    }
  }

  function renderInactive() {
    stopPolling();
    container.innerHTML = `
      <div class="max-w-md mx-auto mt-12 space-y-6">
        <div class="text-center">
          <h1 class="font-pixel text-retro-accent text-lg mb-2">DAVET</h1>
        </div>
        <div class="card-retro p-6 text-center space-y-4">
          <div class="text-4xl mb-2">🚫</div>
          <h2 class="font-pixel text-red-400 text-sm">ODA ARTIK AKTİF DEĞİL</h2>
          <p class="font-vt323 text-retro-text/50">Bu oda ${roomData.status === 'finished' ? 'oyun tamamlandığı için' : ''} kapatılmış.</p>
          <button class="btn-retro" id="btn-go-home">ANA SAYFAYA DÖN</button>
        </div>
      </div>
    `;
    const homeBtn = document.getElementById('btn-go-home');
    if (homeBtn) homeBtn.addEventListener('click', () => Router.navigate('/'));
  }

  function startPolling() {
    pollInterval = setInterval(async () => {
      try {
        const res = await Api.get(`/rooms/preview/${code}`);
        const newData = res.data;

        // Oda kapandıysa
        if (newData.status === 'abandoned' || newData.status === 'finished') {
          roomData = newData;
          renderInactive();
          return;
        }

        // is_private değiştiyse tam re-render (şifre alanı göster/gizle)
        if (newData.is_private !== roomData.is_private) {
          roomData = newData;
          renderInvite();
          return;
        }

        // Dinamik alanları güncelle
        const playerEl = document.getElementById('invite-player-count');
        if (playerEl) playerEl.textContent = `${newData.player_count || 0}/${newData.max_players || 10}`;

        const roundEl = document.getElementById('invite-round-count');
        if (roundEl) roundEl.textContent = newData.total_rounds || 5;

        const timeEl = document.getElementById('invite-time');
        if (timeEl) timeEl.textContent = `${newData.time_per_round || 120}s`;

        const catEl = document.getElementById('invite-category-count');
        if (catEl) catEl.textContent = newData.category_count || 0;

        const votingEl = document.getElementById('invite-voting-timer');
        if (votingEl) votingEl.textContent = formatVotingTimer(newData.voting_timer);

        const revealEl = document.getElementById('invite-reveal-mode');
        if (revealEl) revealEl.textContent = formatRevealMode(newData.answer_reveal_mode);

        const maxEl = document.getElementById('invite-max-players');
        if (maxEl) maxEl.textContent = newData.max_players || 10;

        const privacyEl = document.getElementById('invite-privacy');
        if (privacyEl) privacyEl.textContent = newData.is_private ? '🔒 Şifreli' : '🔓 Açık';

        // Durum göstergeleri
        const statusEl = document.getElementById('invite-status-msg');
        const joinBtn = document.getElementById('btn-join-room');
        const isFull = (newData.player_count || 0) >= (newData.max_players || 10);
        const isPlaying = newData.status === 'playing';

        if (statusEl) {
          if (isPlaying) {
            statusEl.innerHTML = '<p class="font-vt323 text-retro-gold text-center">⚠ Oyun devam ediyor</p>';
          } else if (isFull) {
            statusEl.innerHTML = '<p class="font-vt323 text-red-400 text-center">Oda dolu</p>';
          } else {
            statusEl.innerHTML = '';
          }
        }

        if (joinBtn) joinBtn.disabled = isFull || isPlaying;
        roomData = newData;
      } catch (err) {
        console.warn('Room polling error:', err.message);
        stopPolling();
      }
    }, 3000);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  function renderInvite() {
    const user = Store.get('user');
    const isPlaying = roomData.status === 'playing';
    const isFull = (roomData.player_count || 0) >= (roomData.max_players || 10);

    container.innerHTML = `
      <div class="max-w-md mx-auto mt-12 space-y-6">
        <div class="text-center">
          <h1 class="font-pixel text-retro-accent text-lg mb-2">DAVET</h1>
          <p class="font-vt323 text-retro-text/50">Bir odaya davet edildiniz</p>
        </div>

        <div class="card-retro p-6 space-y-4">
          <div class="text-center">
            <h2 class="font-pixel text-retro-gold text-sm">${escapeHtml(roomData.name || `Oda ${code}`)}</h2>
            <span class="font-mono text-xs text-retro-text/40">${code}</span>
          </div>

          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="text-center p-2 rounded bg-retro-bg/50">
              <span class="font-pixel text-xs text-retro-text/50 block">OYUNCULAR</span>
              <span class="font-vt323 text-lg text-retro-accent" id="invite-player-count">${roomData.player_count || 0}/${roomData.max_players || 10}</span>
            </div>
            <div class="text-center p-2 rounded bg-retro-bg/50">
              <span class="font-pixel text-xs text-retro-text/50 block">TUR</span>
              <span class="font-vt323 text-lg text-retro-accent" id="invite-round-count">${roomData.total_rounds || 5}</span>
            </div>
            <div class="text-center p-2 rounded bg-retro-bg/50">
              <span class="font-pixel text-xs text-retro-text/50 block">SÜRE</span>
              <span class="font-vt323 text-lg text-retro-accent" id="invite-time">${roomData.time_per_round || 120}s</span>
            </div>
            <div class="text-center p-2 rounded bg-retro-bg/50">
              <span class="font-pixel text-xs text-retro-text/50 block">KATEGORİ</span>
              <span class="font-vt323 text-lg text-retro-accent" id="invite-category-count">${roomData.category_count || 0}</span>
            </div>
            <div class="text-center p-2 rounded bg-retro-bg/50">
              <span class="font-pixel text-xs text-retro-text/50 block">OYLAMA SÜRESİ</span>
              <span class="font-vt323 text-lg text-retro-accent" id="invite-voting-timer">${formatVotingTimer(roomData.voting_timer)}</span>
            </div>
            <div class="text-center p-2 rounded bg-retro-bg/50">
              <span class="font-pixel text-xs text-retro-text/50 block">CEVAP GÖSTERİMİ</span>
              <span class="font-vt323 text-lg text-retro-accent" id="invite-reveal-mode">${formatRevealMode(roomData.answer_reveal_mode)}</span>
            </div>
            <div class="text-center p-2 rounded bg-retro-bg/50">
              <span class="font-pixel text-xs text-retro-text/50 block">MAX OYUNCU</span>
              <span class="font-vt323 text-lg text-retro-accent" id="invite-max-players">${roomData.max_players || 10}</span>
            </div>
            <div class="text-center p-2 rounded bg-retro-bg/50">
              <span class="font-pixel text-xs text-retro-text/50 block">GİZLİLİK</span>
              <span class="font-vt323 text-lg text-retro-accent" id="invite-privacy">${roomData.is_private ? '🔒 Şifreli' : '🔓 Açık'}</span>
            </div>
          </div>

          <div id="invite-status-msg">
            ${isPlaying ? '<p class="font-vt323 text-retro-gold text-center">⚠ Oyun devam ediyor</p>' : ''}
            ${isFull ? '<p class="font-vt323 text-red-400 text-center">Oda dolu</p>' : ''}
          </div>

          <div id="invite-password-area">
            ${roomData.is_private ? `
              <div>
                <label class="font-vt323 text-sm text-retro-text/70 block mb-1">Oda Şifresi</label>
                <input type="password" id="invite-password" class="input-retro text-sm py-2 w-full" placeholder="Şifre..." maxlength="50" />
              </div>
            ` : ''}
          </div>

          ${user ? `
            <button class="btn-retro w-full" id="btn-join-room" ${isFull || isPlaying ? 'disabled' : ''}>
              ODAYA KATIL
            </button>
          ` : `
            <div class="space-y-3">
              <p class="font-vt323 text-sm text-retro-text/50 text-center">Katılmak için giriş yap veya misafir ol</p>
              <button class="btn-retro w-full" id="btn-go-auth">GİRİŞ YAP / KAYIT OL</button>
              <button class="btn-retro-secondary w-full" id="btn-guest-join">MİSAFİR OLARAK KATIL</button>
              <div id="guest-nickname-area" class="hidden space-y-2">
                <input type="text" id="guest-nickname" class="input-retro text-sm py-2 w-full" placeholder="Takma ad (3-15 karakter)..." minlength="3" maxlength="15" />
                <button class="btn-retro-secondary w-full" id="btn-guest-confirm">KATIL</button>
                <p id="guest-error" class="font-vt323 text-xs text-red-400 hidden"></p>
              </div>
            </div>
          `}
        </div>
      </div>
    `;

    // Event listeners
    const joinBtn = document.getElementById('btn-join-room');
    if (joinBtn) joinBtn.addEventListener('click', () => joinRoom());

    const authBtn = document.getElementById('btn-go-auth');
    if (authBtn) {
      authBtn.addEventListener('click', () => {
        Store.set('pendingInvite', code);
        Router.navigate('/auth');
      });
    }

    const guestBtn = document.getElementById('btn-guest-join');
    if (guestBtn) {
      guestBtn.addEventListener('click', () => {
        guestBtn.classList.add('hidden');
        const area = document.getElementById('guest-nickname-area');
        if (area) area.classList.remove('hidden');
        const input = document.getElementById('guest-nickname');
        if (input) input.focus();
      });
    }

    const guestConfirmBtn = document.getElementById('btn-guest-confirm');
    if (guestConfirmBtn) {
      guestConfirmBtn.addEventListener('click', handleGuestJoin);
    }

    const nicknameInput = document.getElementById('guest-nickname');
    if (nicknameInput) {
      nicknameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleGuestJoin();
      });
    }
  }

  async function handleGuestJoin() {
    const nicknameInput = document.getElementById('guest-nickname');
    const errEl = document.getElementById('guest-error');
    const confirmBtn = document.getElementById('btn-guest-confirm');
    if (!nicknameInput) return;

    const nickname = nicknameInput.value.trim();
    if (errEl) { errEl.classList.add('hidden'); errEl.textContent = ''; }

    // Client-side validation
    if (nickname.length < 3 || nickname.length > 15) {
      if (errEl) { errEl.textContent = 'Takma ad 3-15 karakter arasında olmalıdır'; errEl.classList.remove('hidden'); }
      return;
    }
    if (!/^[a-zA-ZçÇğĞıİöÖşŞüÜ0-9_]+$/.test(nickname)) {
      if (errEl) { errEl.textContent = 'Takma ad sadece harf, rakam ve _ içerebilir'; errEl.classList.remove('hidden'); }
      return;
    }

    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Bekle...'; }

    try {
      const res = await Api.post('/auth/guest', { nickname });
      Store.saveAuth(res.data.user, res.data.accessToken);
      SocketClient.connect();

      // Socket bağlantısını bekle
      const connected = await waitForSocketConnection();
      if (!connected) {
        throw new Error('Sunucuya bağlanılamadı, tekrar deneyin');
      }
      joinRoom();
    } catch (err) {
      if (errEl) { errEl.textContent = err.message || 'Misafir girişi başarısız'; errEl.classList.remove('hidden'); }
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'KATIL'; }
    }
  }

  function waitForSocketConnection() {
    return new Promise((resolve) => {
      const unsub = SocketClient.on('_connected', () => {
        unsub();
        clearTimeout(timer);
        resolve(true);
      });
      const timer = setTimeout(() => {
        unsub();
        resolve(false);
      }, 5000);
    });
  }

  function joinRoom() {
    const password = document.getElementById('invite-password')?.value || '';

    // Her iki buton türünü de bul (logged-in vs guest)
    const joinBtn = document.getElementById('btn-join-room');
    const guestBtn = document.getElementById('btn-guest-confirm');
    const activeBtn = joinBtn || guestBtn;

    if (joinBtn) { joinBtn.disabled = true; joinBtn.textContent = 'KATILINIYOR...'; }
    if (guestBtn) { guestBtn.disabled = true; guestBtn.textContent = 'KATILINIYOR...'; }

    SocketClient.send('room:join', { code, password });

    let unsub1, unsub2, joinTimeout;

    function cleanup() {
      if (unsub1) unsub1();
      if (unsub2) unsub2();
      clearTimeout(joinTimeout);
    }

    unsub1 = SocketClient.on('room:joined', () => {
      cleanup();
      stopPolling();
      Router.navigate(`/room/${code}`);
    });

    unsub2 = SocketClient.on('room:error', ({ message }) => {
      cleanup();
      Toast.error(message || 'Odaya katılınamadı');
      resetJoinButton();
    });

    // 8 saniye timeout — sunucu yanıt vermezse
    joinTimeout = setTimeout(() => {
      cleanup();
      Toast.error('Sunucu yanıt vermedi, tekrar deneyin');
      resetJoinButton();
    }, 8000);
  }

  function resetJoinButton() {
    const joinBtn = document.getElementById('btn-join-room');
    const guestBtn = document.getElementById('btn-guest-confirm');
    if (joinBtn) { joinBtn.disabled = false; joinBtn.textContent = 'ODAYA KATIL'; }
    if (guestBtn) { guestBtn.disabled = false; guestBtn.textContent = 'KATIL'; }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  render();

  return {
    destroy() {
      stopPolling();
    },
  };
}

Router.register('/invite/:code', (container, ctx) => {
  return InviteView(container, ctx);
});
