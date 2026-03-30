// Room View — Oda Bekleme Ekranı (Yeni Lobby)
function RoomView(container, { params }) {
  const code = params.code;
  let chatComp = null;
  let catEditor = null;
  let letterSel = null;
  const unsubscribers = [];

  async function render() {
    container.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <!-- Sol: Oyuncular -->
        <div class="space-y-4">
          <div class="card-retro p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-pixel text-xs text-retro-gold">OYUNCULAR</h3>
              <span class="font-vt323 text-xs text-retro-text/40" id="player-counter">0/4</span>
            </div>
            <div id="player-slots" class="space-y-2">
              <p class="font-vt323 text-retro-text/40 text-sm">Yükleniyor...</p>
            </div>
          </div>

          <button class="btn-retro-outline text-xs w-full" id="btn-leave-room">ODADAN AYRIL</button>
        </div>

        <!-- Orta: Ayarlar + Kategoriler + Harfler -->
        <div class="lg:col-span-2 space-y-4">
          <!-- Oda Başlık -->
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-pixel text-retro-accent text-sm" id="room-name">ODA</h2>
              <p class="font-vt323 text-retro-text/60 flex items-center gap-1">
                Kod: <span class="text-retro-gold font-mono" id="room-code">*******</span>
                <button class="text-retro-accent/50 hover:text-retro-accent text-xs" id="btn-toggle-code" title="Kodu göster/gizle">👁️‍🗨️</button>
                <button class="text-retro-accent/50 hover:text-retro-accent text-xs" id="btn-copy-code">📋</button>
                <button class="text-retro-accent/50 hover:text-retro-accent text-xs" id="btn-copy-link">🔗</button>
              </p>
            </div>
          </div>

          <!-- Ayarlar -->
          <div class="card-retro p-4" id="settings-panel">
            <h3 class="font-pixel text-xs text-retro-gold mb-3">ODA AYARLARI</h3>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3" id="settings-fields">
              <!-- Dinamik olarak doldurulur -->
            </div>
          </div>

          <!-- Kategoriler -->
          <div class="card-retro p-4" id="category-panel"></div>

          <!-- Harfler -->
          <div class="card-retro p-4" id="letter-panel"></div>

          <!-- Başlat -->
          <div class="flex gap-3">
            <button class="btn-retro flex-1" id="btn-ready">HAZIRIM ✓</button>
            <button class="btn-retro-secondary flex-1 hidden" id="btn-start-game">OYUNU BAŞLAT 🎮</button>
          </div>
        </div>

        <!-- Sağ: Chat -->
        <div id="room-chat"></div>
      </div>
    `;

    // Chat
    chatComp = ChatComponent.render(document.getElementById('room-chat'), { roomId: code });

    // Event listeners
    // Room code toggle visibility
    let codeVisible = false;
    const codeEl = document.getElementById('room-code');
    const toggleBtn = document.getElementById('btn-toggle-code');
    toggleBtn.addEventListener('click', () => {
      codeVisible = !codeVisible;
      codeEl.textContent = codeVisible ? code : '*******';
      toggleBtn.textContent = codeVisible ? '🙈' : '👁️‍🗨️';
      toggleBtn.title = codeVisible ? 'Kodu gizle' : 'Kodu göster';
    });

    document.getElementById('btn-copy-code').addEventListener('click', () => {
      navigator.clipboard.writeText(code);
      Toast.info('Kod kopyalandı!');
    });

    document.getElementById('btn-copy-link').addEventListener('click', () => {
      const link = `${window.location.origin}/invite/${code}`;
      navigator.clipboard.writeText(link);
      Toast.info('Davet linki kopyalandı!');
    });

    document.getElementById('btn-leave-room').addEventListener('click', () => {
      SocketClient.send('room:leave');
      Router.navigate('/');
    });

    const readyBtn = document.getElementById('btn-ready');
    let isReady = false;
    readyBtn.addEventListener('click', () => {
      isReady = !isReady;
      readyBtn.textContent = isReady ? 'HAZIR DEĞİLİM ✗' : 'HAZIRIM ✓';
      readyBtn.className = isReady ? 'btn-retro-outline flex-1' : 'btn-retro flex-1';
      SocketClient.send('room:ready', { ready: isReady });
    });

    document.getElementById('btn-start-game').addEventListener('click', () => {
      SocketClient.send('game:start');
    });

    // Oda bilgisi yükle
    try {
      const data = await Api.get(`/rooms/code/${code}`);
      updateRoomInfo(data.data);
    } catch (err) {
      Toast.error('Oda bulunamadı');
      Router.navigate('/');
      return;
    }

    // Socket events
    const unsub1 = SocketClient.on('room:player_joined', (d) => updatePlayers(d.players));
    const unsub2 = SocketClient.on('room:player_left', (d) => updatePlayers(d.players));
    const unsub3 = SocketClient.on('room:ready_update', (d) => {
      updatePlayers(d.players);
      checkStartButton(d.allReady);
    });
    const unsub4 = SocketClient.on('game:started', (d) => {
      Store.set('currentRoom', d.room);
      Store.set('currentRound', d.round);
      Store.set('players', d.players);
      Store.set('gameState', 'playing');
      Router.navigate(`/game/${code}`);
    });
    const unsub5 = SocketClient.on('room:settings_updated', (d) => {
      const room = Store.get('currentRoom');
      if (room) {
        Object.assign(room, d.settings);
        Store.set('currentRoom', room);
        renderSettings(room);
        // maxPlayers değiştiyse player slotlarını güncelle
        const players = Store.get('players') || [];
        updatePlayers(players);
      }
    });
    const unsub6 = SocketClient.on('room:categories_updated', (d) => {
      const room = Store.get('currentRoom');
      if (room) {
        room.categories = d.categories;
        Store.set('currentRoom', room);
      }
      const user = Store.get('user');
      const owner = room && room.owner_id === user?.id;
      if (catEditor) CategoryEditor.updateCategories(d.categories, owner);
    });
    const unsub7 = SocketClient.on('room:letters_updated', (d) => {
      const room = Store.get('currentRoom');
      if (room) {
        room.enabled_letters = d.letters;
        Store.set('currentRoom', room);
      }
      const user = Store.get('user');
      const owner = room && room.owner_id === user?.id;
      if (letterSel) LetterSelector.updateLetters(d.letters, owner);
    });
    // room:joined — katıldıktan sonra backend'den güncel oda verisini al
    const unsub8 = SocketClient.on('room:joined', (d) => {
      if (d.room) updateRoomInfo(d.room);
      // socket.currentRoom artık set edildi, chat geçmişini yükle
      ChatComponent.loadHistory();
    });
    // room:owner_changed — sahiplik devredildiğinde tüm UI'ı güncelle
    const unsub9 = SocketClient.on('room:owner_changed', (d) => {
      if (d.room) {
        updateRoomInfo(d.room);
        const players = Store.get('players') || [];
        checkStartButton(players.length >= 2 && players.every(p => p.is_ready));
        // Yeni sahibin adını bul
        const newOwner = (d.room.players || []).find(p => p.user_id === d.newOwnerId);
        const ownerName = newOwner ? (newOwner.display_name || newOwner.username || 'Oyuncu') : 'Oyuncu';
        Toast.info(`Oda sahipliği ${ownerName} kişisine devredildi`);
      }
    });
    // room:error — oda ile ilgili hatalar
    const unsub10 = SocketClient.on('room:error', ({ message }) => {
      Toast.error(message || 'Bir hata oluştu');
    });
    // game:error — oyun başlatma vb. hatalar
    const unsub11 = SocketClient.on('game:error', ({ message }) => {
      Toast.error(message || 'Oyun hatası');
    });
    // room:kicked — oyuncu atıldığında
    const unsub12 = SocketClient.on('room:kicked', () => {
      Toast.error('Odadan atıldınız');
      Router.navigate('/');
    });
    // room:closed — oda kapatıldığında
    const unsub13 = SocketClient.on('room:closed', () => {
      Toast.warn('Oda kapatıldı');
      Router.navigate('/');
    });
    // room:reset — oyun sonrası odanın sıfırlanması
    const unsub14 = SocketClient.on('room:reset', (d) => {
      if (d.room) {
        Store.set('currentRound', null);
        Store.set('gameState', 'idle');
        Store.set('votes', {});
        Store.set('detailedAnswers', []);
        updateRoomInfo(d.room);
        Toast.info('Oda yeni oyun için sıfırlandı');
      }
    });
    // Socket bağlantısı hazırsa hemen gönder, değilse bağlanınca gönder
    let joined = false;
    const doJoin = () => {
      if (joined) return;
      joined = true;
      SocketClient.send('room:join', { code });
    };
    const unsub15 = SocketClient.on('_connected', doJoin);
    unsubscribers.push(unsub1, unsub2, unsub3, unsub4, unsub5, unsub6, unsub7, unsub8, unsub9, unsub10, unsub11, unsub12, unsub13, unsub14, unsub15);

    // Socket room join — hemen dene (bağlantı varsa gider, yoksa _connected ile gidecek)
    doJoin();
  }

  function updateRoomInfo(room) {
    const nameEl = document.getElementById('room-name');
    if (nameEl) nameEl.textContent = room.name;

    if (room.players) updatePlayers(room.players);
    Store.set('currentRoom', room);

    renderSettings(room);

    // Category editor
    const user = Store.get('user');
    const owner = room.owner_id === user?.id;
    catEditor = CategoryEditor.render(document.getElementById('category-panel'), {
      categories: room.categories || [],
      isOwner: owner,
      roomId: room.id,
    });

    // Letter selector
    letterSel = LetterSelector.render(document.getElementById('letter-panel'), {
      enabledLetters: room.enabled_letters || null,
      isOwner: owner,
    });
  }

  function renderSettings(room) {
    const user = Store.get('user');
    const owner = room.owner_id === user?.id;
    const fieldsEl = document.getElementById('settings-fields');
    if (!fieldsEl) return;

    if (owner) {
      fieldsEl.innerHTML = `
        <div>
          <label class="font-vt323 text-xs text-retro-text/50 block mb-1">Tur Sayısı <span class="tooltip-trigger" data-tip="Oyunda kaç tur oynanacağını belirler. Her turda yeni bir harf seçilir.">ℹ️</span></label>
          <select class="input-retro text-sm py-1" id="set-rounds">
            ${[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(n => `<option value="${n}" ${room.total_rounds === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="font-vt323 text-xs text-retro-text/50 block mb-1">Tur Süresi <span class="tooltip-trigger" data-tip="Her turda cevap yazma süresi (saniye). Süre dolduğunda cevaplar otomatik gönderilir.">ℹ️</span></label>
          <select class="input-retro text-sm py-1" id="set-time">
            ${[30,45,60,90,120,150,180,240,300].map(n => `<option value="${n}" ${room.time_per_round === n ? 'selected' : ''}>${n} sn</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="font-vt323 text-xs text-retro-text/50 block mb-1">Max Oyuncu <span class="tooltip-trigger" data-tip="Odaya katılabilecek en fazla oyuncu sayısı.">ℹ️</span></label>
          <select class="input-retro text-sm py-1" id="set-max">
            ${[2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(n => `<option value="${n}" ${room.max_players === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="font-vt323 text-xs text-retro-text/50 block mb-1">Oylama Süresi <span class="tooltip-trigger" data-tip="Oylamanın ne kadar süreceği. Süresiz modda oda sahibi oylamayı manuel bitirir.">ℹ️</span></label>
          <div class="flex items-center gap-2">
            <label class="flex items-center gap-1 cursor-pointer">
              <input type="radio" name="voting-mode" value="timed" ${room.voting_timer > 0 ? 'checked' : ''} class="accent-retro-accent" />
              <span class="font-vt323 text-xs text-retro-text/70">Süreli</span>
            </label>
            <label class="flex items-center gap-1 cursor-pointer">
              <input type="radio" name="voting-mode" value="unlimited" ${room.voting_timer === 0 ? 'checked' : ''} class="accent-retro-accent" />
              <span class="font-vt323 text-xs text-retro-text/70">Süresiz</span>
            </label>
          </div>
          <input type="number" id="set-voting-input" class="input-retro text-sm py-1 mt-1 w-full ${room.voting_timer === 0 ? 'hidden' : ''}" min="10" max="300" step="5" value="${room.voting_timer || 60}" />
        </div>
        <div>
          <label class="font-vt323 text-xs text-retro-text/50 block mb-1">Cevap Gösterimi <span class="tooltip-trigger" data-tip="Direkt: Cevaplar oylamada herkese açık görünür. Butonla: Her oyuncu kendi cevabını 'Cevabı Göster' butonuyla açar.">ℹ️</span></label>
          <div class="flex items-center gap-2">
            <label class="flex items-center gap-1 cursor-pointer">
              <input type="radio" name="reveal-mode" value="direct" ${room.answer_reveal_mode !== 'button' ? 'checked' : ''} class="accent-retro-accent" />
              <span class="font-vt323 text-xs text-retro-text/70">Direkt</span>
            </label>
            <label class="flex items-center gap-1 cursor-pointer">
              <input type="radio" name="reveal-mode" value="button" ${room.answer_reveal_mode === 'button' ? 'checked' : ''} class="accent-retro-accent" />
              <span class="font-vt323 text-xs text-retro-text/70">Butonla</span>
            </label>
          </div>
        </div>
        <div>
          <label class="font-vt323 text-xs text-retro-text/50 block mb-1">Gizlilik <span class="tooltip-trigger" data-tip="Açık: Herkes lobiden katılabilir. Özel: Sadece şifre veya davet linki ile katılınır.">ℹ️</span></label>
          <select class="input-retro text-sm py-1" id="set-privacy">
            <option value="public" ${!room.has_password ? 'selected' : ''}>Açık</option>
            <option value="private" ${room.has_password ? 'selected' : ''}>Özel</option>
          </select>
          <input type="password" id="set-password" class="input-retro text-sm py-1 mt-1 w-full ${!room.has_password ? 'hidden' : ''}" placeholder="Şifre girin..." maxlength="50" />
          <p id="password-status" class="font-vt323 text-[10px] mt-0.5 ${room.has_password ? 'text-retro-green/70' : 'hidden'}">🔒 Şifre ayarlı</p>
        </div>
      `;

      // Settings change listeners
      const settingsInputs = ['set-rounds', 'set-time', 'set-max'];
      settingsInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.addEventListener('change', () => sendSettingsUpdate());
        }
      });

      // Privacy dropdown + password input toggle
      const privacyEl = document.getElementById('set-privacy');
      const passwordEl = document.getElementById('set-password');
      const passwordStatus = document.getElementById('password-status');
      if (privacyEl) {
        privacyEl.addEventListener('change', () => {
          if (privacyEl.value === 'private') {
            if (passwordEl) {
              passwordEl.classList.remove('hidden');
              passwordEl.focus();
            }
            // Don't send yet — wait for password
          } else {
            if (passwordEl) {
              passwordEl.classList.add('hidden');
              passwordEl.value = '';
            }
            if (passwordStatus) {
              passwordStatus.classList.add('hidden');
            }
            sendSettingsUpdate();
          }
        });
      }
      // Password input — send on Enter or blur
      if (passwordEl) {
        const submitPassword = () => {
          if (privacyEl.value === 'private' && passwordEl.value.trim()) {
            sendSettingsUpdate();
            if (passwordStatus) {
              passwordStatus.textContent = '🔒 Şifre ayarlı';
              passwordStatus.classList.remove('hidden');
            }
          } else if (privacyEl.value === 'private' && !passwordEl.value.trim()) {
            Toast.warn('Özel oda için şifre girin');
          }
        };
        passwordEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') submitPassword();
        });
        passwordEl.addEventListener('blur', () => {
          if (passwordEl.value.trim()) submitPassword();
        });
      }

      // Answer reveal mode radio
      const revealRadios = document.querySelectorAll('input[name="reveal-mode"]');
      revealRadios.forEach(radio => {
        radio.addEventListener('change', () => sendSettingsUpdate());
      });

      // Voting timer radio + input
      const votingRadios = document.querySelectorAll('input[name="voting-mode"]');
      const votingInput = document.getElementById('set-voting-input');
      votingRadios.forEach(radio => {
        radio.addEventListener('change', () => {
          if (radio.value === 'unlimited') {
            if (votingInput) votingInput.classList.add('hidden');
          } else {
            if (votingInput) votingInput.classList.remove('hidden');
          }
          sendSettingsUpdate();
        });
      });
      if (votingInput) {
        votingInput.addEventListener('change', () => sendSettingsUpdate());
      }

      function sendSettingsUpdate() {
        const settings = {};
        const rv = document.getElementById('set-rounds');
        const tv = document.getElementById('set-time');
        const mv = document.getElementById('set-max');
        const pv = document.getElementById('set-privacy');
        if (rv) settings.totalRounds = parseInt(rv.value);
        if (tv) settings.timePerRound = parseInt(tv.value);
        if (mv) settings.maxPlayers = parseInt(mv.value);
        if (pv) settings.privacy = pv.value;

        // Password
        const pwEl = document.getElementById('set-password');
        if (pwEl && pwEl.value.trim() && pv && pv.value === 'private') {
          settings.password = pwEl.value.trim();
        }

        // Answer reveal mode
        const revealSel = document.querySelector('input[name="reveal-mode"]:checked');
        if (revealSel) settings.answerRevealMode = revealSel.value;

        // Voting timer
        const selectedMode = document.querySelector('input[name="voting-mode"]:checked');
        const votingVal = document.getElementById('set-voting-input');
        if (selectedMode && selectedMode.value === 'unlimited') {
          settings.votingTimer = 0;
        } else if (votingVal) {
          settings.votingTimer = parseInt(votingVal.value) || 60;
        }

        SocketClient.send('room:update_settings', settings);
      }
    } else {
      fieldsEl.innerHTML = `
        <div>
          <span class="font-vt323 text-xs text-retro-text/50">Tur:</span>
          <span class="font-vt323 text-sm text-retro-text">${room.total_rounds}</span>
        </div>
        <div>
          <span class="font-vt323 text-xs text-retro-text/50">Süre:</span>
          <span class="font-vt323 text-sm text-retro-text">${room.time_per_round} sn</span>
        </div>
        <div>
          <span class="font-vt323 text-xs text-retro-text/50">Max:</span>
          <span class="font-vt323 text-sm text-retro-text">${room.max_players}</span>
        </div>
        <div>
          <span class="font-vt323 text-xs text-retro-text/50">Oylama:</span>
          <span class="font-vt323 text-sm text-retro-text">${room.voting_timer > 0 ? room.voting_timer + ' sn' : 'Süresiz'}</span>
        </div>
        <div>
          <span class="font-vt323 text-xs text-retro-text/50">Cevap:</span>
          <span class="font-vt323 text-sm text-retro-text">${room.answer_reveal_mode === 'button' ? '🔘 Butonla' : '👁 Direkt'}</span>
        </div>
        <div>
          <span class="font-vt323 text-xs text-retro-text/50">Gizlilik:</span>
          <span class="font-vt323 text-sm text-retro-text">${room.has_password ? '🔒 Özel' : '🔓 Açık'}</span>
        </div>
      `;
    }
  }

  function updatePlayers(players) {
    const listEl = document.getElementById('player-slots');
    const counterEl = document.getElementById('player-counter');
    if (!listEl || !players) return;

    const user = Store.get('user');
    const room = Store.get('currentRoom');
    const maxPlayers = room?.max_players || 4;
    const isOwner = room && room.owner_id === user?.id;

    if (counterEl) counterEl.textContent = `${players.length}/${maxPlayers}`;

    // Dolu slotlar
    let html = players.map(p => `
      <div class="flex items-center gap-2 p-2 rounded border
                  ${p.is_owner ? 'border-retro-gold/50 bg-retro-gold/5' : p.is_ready ? 'border-retro-green/50 bg-retro-green/10' : 'border-retro-accent/20 bg-retro-surface/50'}">
        <div class="player-avatar text-xs ${p.is_owner ? 'border-retro-gold' : p.user_id === user?.id ? 'border-retro-accent' : ''}">
          ${(p.display_name || p.username || '?')[0].toUpperCase()}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1">
            <p class="font-vt323 text-sm truncate">${escapeHtml(p.display_name || p.username || 'Oyuncu')}</p>
            ${p.is_owner ? '<span class="badge-retro text-[10px] py-0 px-1 bg-retro-gold/20 text-retro-gold border-retro-gold/50">👑 Sahip</span>' : ''}
          </div>
          <p class="font-mono text-xs text-retro-text/40">
            ${p.is_ready ? '✓ Hazır' : '⏳ Bekliyor'}
          </p>
        </div>
        ${isOwner && !p.is_owner && p.user_id !== user?.id ? `<button class="text-xs text-retro-text/30 hover:text-retro-gold transition-colors" data-transfer="${p.user_id}" title="Sahipliği devret">👑</button>` : ''}
      </div>
    `).join('');

    // Boş slotlar
    const empty = maxPlayers - players.length;
    for (let i = 0; i < empty; i++) {
      html += `
        <div class="flex items-center gap-2 p-2 rounded border border-dashed border-retro-text/10">
          <div class="w-8 h-8 rounded-full bg-retro-surface/20 flex items-center justify-center text-retro-text/20 text-xs">?</div>
          <span class="font-vt323 text-sm text-retro-text/20">Müsait</span>
        </div>
      `;
    }

    listEl.innerHTML = html;
    Store.set('players', players);

    // Sahiplik devir butonları
    listEl.querySelectorAll('[data-transfer]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetUserId = parseInt(btn.dataset.transfer, 10);
        const targetPlayer = players.find(p => p.user_id === targetUserId);
        const targetName = targetPlayer ? (targetPlayer.display_name || targetPlayer.username || 'Oyuncu') : 'Oyuncu';
        if (confirm(`Oda sahipliğini ${targetName} kişisine devretmek istediğinize emin misiniz?`)) {
          SocketClient.send('room:transfer_ownership', { targetUserId });
        }
      });
    });
  }

  function checkStartButton(allReady) {
    const user = Store.get('user');
    const room = Store.get('currentRoom');
    const startBtn = document.getElementById('btn-start-game');
    if (!startBtn) return;

    if (room && room.owner_id === user?.id && allReady) {
      startBtn.classList.remove('hidden');
    } else {
      startBtn.classList.add('hidden');
    }
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
      CategoryEditor.destroy();
      LetterSelector.destroy();
      ChatComponent.destroy();
    },
  };
}

Router.register('/room/:code', (container, ctx) => {
  if (!Store.get('user')) {
    Router.navigate('/auth');
    return { destroy() {} };
  }
  return RoomView(container, ctx);
});
