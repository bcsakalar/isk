// Lobby View — Ana Ekran / Oda Listesi
function LobbyView(container) {
  const unsubscribers = [];
  const isAuthenticated = !!Store.get('user');

  function render() {
    container.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <!-- Sol: Oda Listesi -->
        <div class="lg:col-span-2 space-y-4">
          ${!isAuthenticated ? `
          <div class="card-retro p-5 border-retro-accent/30">
            <p class="font-pixel text-xs text-retro-accent mb-3">🎮 HEMEN OYNAMAYA BAŞLA</p>
            <div id="guest-inline-area">
              <div class="flex flex-col sm:flex-row gap-2">
                <a href="/auth" data-link class="btn-retro text-xs flex-1 text-center">GİRİŞ YAP / KAYIT OL</a>
                <button id="btn-guest-toggle" class="btn-retro-outline text-xs flex-1 border-retro-green text-retro-green hover:bg-retro-green/10">👤 MİSAFİR OLARAK OYNA</button>
              </div>
              <p class="font-vt323 text-xs text-retro-text/30 mt-2">Misafirler kayıt olmadan hızlıca oynar — istatistikler kaydedilmez</p>
            </div>
          </div>
          ` : ''}

          <!-- Başlık ve Oda Oluştur -->
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-pixel text-retro-accent text-sm">LOBİ</h2>
              ${isAuthenticated ? `
              <p class="font-vt323 text-retro-text/60" id="lobby-online">
                <span class="text-retro-green">●</span> 0 oyuncu online
              </p>
              ` : '<p class="font-vt323 text-retro-text/40 text-xs">Aktif odaları aşağıda görebilirsin</p>'}
            </div>
            ${isAuthenticated
              ? '<button class="btn-retro text-xs" id="btn-create-room">+ YENİ ODA</button>'
              : ''}
          </div>

          ${isAuthenticated && Store.isGuest() ? '<div class="card-retro p-3 border-retro-green/30 bg-retro-green/5 mb-2"><p class="font-vt323 text-sm text-retro-green">👤 Misafir olarak oynuyorsun. <a href="/auth" data-link class="underline hover:text-retro-accent">Kayıt ol</a> → istatistiklerini ve XP\'ni sakla!</p></div>' : ''}

          <!-- Filtre -->
          <div class="flex gap-2">
            <input type="text" id="room-search" class="input-retro text-sm py-2 flex-1" placeholder="Oda ara..." />
            <button class="btn-retro-outline text-xs px-3" id="btn-refresh">↻</button>
          </div>

          <!-- Oda Listesi -->
          <div id="room-list" class="space-y-2">
            <p class="text-center font-vt323 text-retro-text/40 py-8">Odalar yükleniyor...</p>
          </div>
        </div>

        <!-- Sağ: Bilgi -->
        <div class="space-y-4">
          <!-- Oyun Tanıtımı -->
          <div class="card-retro p-4">
            <h4 class="font-pixel text-xs text-retro-gold mb-2">İSİM ŞEHİR KATMAN</h4>
            <p class="font-vt323 text-sm text-retro-text/70 leading-relaxed">
              Klasik İsim Şehir oyununu çok oyunculu ve retro tarzında oyna! Arkadaşlarınla aynı anda yarış, 
              verilen harfle kategorilere cevap yaz, rakiplerinin cevaplarını oyla ve en yüksek puanı topla. 
              Her tur yeni bir harf, her harf yeni bir meydan okuma!
            </p>
          </div>

          <!-- Nasıl Oynanır -->
          <div class="card-retro p-4">
            <h4 class="font-pixel text-xs text-retro-gold mb-2">NASIL OYNANIR?</h4>
            <ol class="font-vt323 text-sm text-retro-text/70 space-y-2">
              <li class="flex gap-2"><span class="text-retro-accent font-pixel text-xs">1.</span> Oda oluştur veya mevcut bir odaya katıl</li>
              <li class="flex gap-2"><span class="text-retro-accent font-pixel text-xs">2.</span> Rastgele bir harf gelir — her kategoriye o harfle başlayan cevap yaz</li>
              <li class="flex gap-2"><span class="text-retro-accent font-pixel text-xs">3.</span> Süre dolunca cevaplar karşılaştırılır</li>
              <li class="flex gap-2"><span class="text-retro-accent font-pixel text-xs">4.</span> Diğer oyuncuların cevaplarını oyla: doğru mu, geçerli mi?</li>
              <li class="flex gap-2"><span class="text-retro-accent font-pixel text-xs">5.</span> Benzersiz ve doğru cevaplar daha çok puan kazandırır</li>
              <li class="flex gap-2"><span class="text-retro-accent font-pixel text-xs">6.</span> Kanıt olarak görsel yükleyebilirsin</li>
            </ol>
          </div>

          <!-- Özellikler -->
          <div class="card-retro p-4">
            <h4 class="font-pixel text-xs text-retro-gold mb-2">ÖZELLİKLER</h4>
            <ul class="font-vt323 text-sm text-retro-text/70 space-y-1">
              <li>⚡ Gerçek zamanlı çok oyunculu</li>
              <li>🏆 Sıralama tablosu ve seviye sistemi</li>
              <li>🎨 Özelleştirilebilir kategoriler</li>
              <li>🔒 Şifreli özel odalar</li>
              <li>📸 Görsel kanıt sistemi</li>
              <li>💬 Oda içi sohbet</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    const createBtn = document.getElementById('btn-create-room');
    if (createBtn) createBtn.addEventListener('click', showCreateRoomModal);

    const guestToggle = document.getElementById('btn-guest-toggle');
    if (guestToggle) guestToggle.addEventListener('click', showGuestInlineForm);

    document.getElementById('btn-refresh').addEventListener('click', () => {
      if (isAuthenticated) {
        SocketClient.send('lobby:refresh');
      } else {
        fetchPublicRooms();
      }
    });
    document.getElementById('room-search').addEventListener('input', handleSearch);

    if (isAuthenticated) {
      // Socket events
      const unsub1 = SocketClient.on('lobby:online_count', ({ count }) => {
        const el = document.getElementById('lobby-online');
        if (el) el.innerHTML = `<span class="text-retro-green">●</span> ${count} oyuncu online`;
      });
      unsubscribers.push(unsub1);

      const unsub2 = SocketClient.on('lobby:rooms', ({ rooms }) => {
        Store.set('rooms', rooms);
        renderRoomList(rooms);
      });
      unsubscribers.push(unsub2);

      // İlk yükle
      SocketClient.send('lobby:refresh');
    } else {
      // REST API ile oda listesini çek
      fetchPublicRooms();
    }
  }

  function showGuestInlineForm() {
    const area = document.getElementById('guest-inline-area');
    if (!area) return;
    area.innerHTML = `
      <form id="guest-inline-form" class="flex flex-col sm:flex-row gap-2">
        <input type="text" name="nickname" class="input-retro text-sm flex-1" placeholder="Takma adını yaz..." maxlength="15" required autofocus />
        <button type="submit" class="btn-retro text-xs bg-retro-green/20 border-retro-green hover:bg-retro-green/40 text-retro-green whitespace-nowrap">OYNA →</button>
      </form>
      <div id="guest-inline-error" class="text-retro-accent font-vt323 text-xs mt-1 hidden"></div>
      <p class="font-vt323 text-xs text-retro-text/30 mt-2">Kayıt olmadan hızlıca oyna — istatistikler kaydedilmez</p>
    `;
    document.getElementById('guest-inline-form').addEventListener('submit', handleGuestLogin);
  }

  async function handleGuestLogin(e) {
    e.preventDefault();
    const form = e.target;
    const errorEl = document.getElementById('guest-inline-error');
    const submitBtn = form.querySelector('button[type="submit"]');

    errorEl.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Bekle...';

    try {
      const nickname = form.nickname.value.trim();
      const nickErr = Validators.nickname(nickname);
      if (nickErr) throw new Error(nickErr);

      const data = await Api.post('/auth/guest', { nickname });
      Store.saveAuth(data.data.user, data.data.accessToken, null);
      SocketClient.connect();
      Toast.success('Hoş geldin, ' + nickname + '!');
      Router.navigate('/');
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'OYNA →';
    }
  }

  async function fetchPublicRooms() {
    try {
      const data = await Api.get('/rooms/public');
      const rooms = data.data || [];
      Store.set('rooms', rooms);
      renderRoomList(rooms);
    } catch {
      const listEl = document.getElementById('room-list');
      if (listEl) listEl.innerHTML = '<p class="text-center font-vt323 text-retro-text/40 py-8">Odalar yüklenemedi</p>';
    }
  }

  function renderRoomList(rooms) {
    const listEl = document.getElementById('room-list');
    if (!listEl) return;

    if (!rooms || rooms.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-8">
          <p class="font-vt323 text-xl text-retro-text/40">Henüz oda yok</p>
          <p class="font-vt323 text-retro-text/30 mt-2">${isAuthenticated ? 'İlk odayı sen oluştur!' : 'Şu an aktif oda bulunmuyor'}</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = rooms.map(room => `
      <div class="card-retro p-3 sm:p-4 hover:border-retro-accent/60 transition-colors cursor-pointer" data-room-code="${escapeAttr(room.code)}">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
          <div>
            <h3 class="font-pixel text-xs text-retro-accent">${escapeHtml(room.name)}</h3>
            ${room.owner_name ? `<p class="font-vt323 text-sm text-retro-gold mt-0.5">👑 ${escapeHtml(room.owner_name)}</p>` : ''}
          </div>
          <div class="flex items-center gap-2">
            <span class="badge-retro">${room.status === 'playing' ? '🎮 Oyunda' : '⏳ Bekliyor'}</span>
            <button class="btn-retro text-xs" data-join="${escapeAttr(room.code)}" ${room.status === 'playing' ? 'disabled' : ''}>KATIL</button>
          </div>
        </div>
        <div class="flex flex-wrap gap-x-2 gap-y-1 sm:gap-x-4 font-vt323 text-xs text-retro-text/50">
          <span>👥 ${room.player_count || 0}/${room.max_players}</span>
          <span>🔄 ${room.total_rounds} tur</span>
          <span>⏱️ ${room.time_per_round} sn</span>
          <span>📂 ${room.category_count || '?'} kategori</span>
          <span>🗳️ ${room.voting_timer > 0 ? room.voting_timer + ' sn' : 'Süresiz'}</span>
          <span>👁️ ${room.answer_reveal_mode === 'button' ? 'Butonla' : 'Direkt'}</span>
        </div>
      </div>
    `).join('');

    // Join butonları
    listEl.querySelectorAll('[data-join]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isAuthenticated) {
          Toast.info('Odaya katılmak için giriş yapın veya misafir olarak oynayın');
          return;
        }
        const code = btn.dataset.join;
        const room = rooms.find(r => r.code === code);
        if (room && room.has_password) {
          showPasswordModal(code);
        } else {
          joinRoom(code);
        }
      });
    });
  }

  function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    const rooms = Store.get('rooms') || [];
    if (!query) return renderRoomList(rooms);
    const filtered = rooms.filter(r =>
      r.name.toLowerCase().includes(query) || (r.owner_name && r.owner_name.toLowerCase().includes(query))
    );
    renderRoomList(filtered);
  }

  function showCreateRoomModal() {
    Modal.show({
      title: 'Yeni Oda Oluştur',
      content: `
        <form id="create-room-form" class="space-y-3">
          <div>
            <label class="font-vt323 text-sm text-retro-text/70 block mb-1">Oda Adı</label>
            <input type="text" name="name" class="input-retro text-sm" placeholder="Oda adı..." maxlength="30" required />
          </div>
          <div>
            <label class="font-vt323 text-sm text-retro-text/70 block mb-1">Şifre (opsiyonel)</label>
            <input type="password" name="password" class="input-retro text-sm" placeholder="Bırak boş = herkese açık" />
            <p class="font-vt323 text-xs text-retro-text/40 mt-1">Diğer ayarları oda içinden değiştirebilirsin</p>
          </div>
          <div id="create-room-error" class="text-retro-accent font-vt323 text-sm hidden"></div>
        </form>
      `,
      buttons: [
        { label: 'İptal', action: 'close', class: 'btn-retro-outline' },
        {
          label: 'Oluştur', action: 'create', class: 'btn-retro',
          onClick: async () => {
            const form = document.getElementById('create-room-form');
            const errEl = document.getElementById('create-room-error');
            try {
              const name = form.name.value.trim();
              const nameErr = Validators.roomName(name);
              if (nameErr) throw new Error(nameErr);

              const body = { name };
              if (form.password.value) body.password = form.password.value;

              const data = await Api.post('/rooms', body);
              Toast.success('Oda oluşturuldu!');
              Router.navigate(`/room/${data.data.code}`);
            } catch (err) {
              if (errEl) {
                errEl.textContent = err.message;
                errEl.classList.remove('hidden');
              }
            }
          },
        },
      ],
    });
  }

  function showPasswordModal(code) {
    Modal.show({
      title: 'Şifreli Oda',
      content: `
        <p class="font-vt323 mb-3">Bu oda şifre korumalı.</p>
        <input type="password" id="room-password-input" class="input-retro" placeholder="Oda şifresi..." />
      `,
      buttons: [
        { label: 'İptal', action: 'close', class: 'btn-retro-outline' },
        {
          label: 'Katıl', action: 'join', class: 'btn-retro',
          onClick: () => {
            const pw = document.getElementById('room-password-input')?.value;
            joinRoom(code, pw);
          },
        },
      ],
    });
  }

  function joinRoom(code, password) {
    SocketClient.send('room:join', { code, password });

    let unsub1, unsub2;
    unsub1 = SocketClient.on('room:joined', () => {
      unsub1();
      unsub2();
      Router.navigate(`/room/${code}`);
    });

    unsub2 = SocketClient.on('room:error', ({ message }) => {
      unsub1();
      unsub2();
      Toast.error(message);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return (str || '').replace(/"/g, '&quot;');
  }

  render();

  return {
    destroy() {
      unsubscribers.forEach(u => u());
    },
  };
}

Router.register('/', (container) => {
  return LobbyView(container);
});
