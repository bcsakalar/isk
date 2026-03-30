// Admin Panel — Dashboard & Management
const AdminApp = (() => {
  const content = () => document.getElementById('admin-content');

  async function init() {
    const user = Store.get('user');
    if (!user || user.role !== 'admin') {
      content().innerHTML = `
        <div class="text-center py-20">
          <p class="font-pixel text-retro-accent text-sm">ERİŞİM ENGELLENDI</p>
          <p class="font-vt323 text-retro-text/50 mt-2">Admin yetkisi gerekli</p>
          <a href="/auth" class="btn-retro mt-4 inline-block text-xs">GİRİŞ YAP</a>
        </div>
      `;
      return;
    }

    loadDashboard();

    // Sidebar link click interception
    document.addEventListener('click', (e) => {
      const anchor = e.target.closest('a[data-nav]');
      if (anchor) {
        e.preventDefault();
        const href = anchor.getAttribute('href');
        if (href) {
          history.pushState(null, '', href);
          handleRoute();
        }
      }
    });

    window.addEventListener('popstate', handleRoute);
    handleRoute();
  }

  function handleRoute() {
    const path = window.location.pathname || '/admin/dashboard';
    if (path.includes('dashboard')) loadDashboard();
    else if (path.includes('users')) loadUsers();
    else if (path.includes('rooms')) loadRooms();
    else if (path.includes('announcements')) loadAnnouncements();
    else if (path.includes('logs')) loadLogs();
    else if (path.includes('reports')) loadReports();
    else if (path.includes('contact')) loadContact();
    else loadDashboard();

    // Active nav
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.classList.toggle('bg-retro-accent/20', path.includes(el.dataset.nav));
      el.classList.toggle('text-retro-accent', path.includes(el.dataset.nav));
    });
  }

  // ======= DASHBOARD =======
  async function loadDashboard() {
    const el = content();
    el.innerHTML = '<p class="font-vt323 text-retro-text/40">Dashboard yükleniyor...</p>';

    try {
      const data = await Api.get('/admin/dashboard');
      const s = data.data;

      el.innerHTML = `
        <h2 class="font-pixel text-retro-accent text-sm mb-6">DASHBOARD</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div class="card-retro text-center p-4">
            <p class="font-pixel text-2xl text-retro-gold">${s.total_users || 0}</p>
            <p class="font-vt323 text-xs text-retro-text/50">Toplam Kullanıcı</p>
          </div>
          <div class="card-retro text-center p-4">
            <p class="font-pixel text-2xl text-retro-green">${s.active_users_24h || 0}</p>
            <p class="font-vt323 text-xs text-retro-text/50">Son 24s Aktif</p>
          </div>
          <div class="card-retro text-center p-4">
            <p class="font-pixel text-2xl text-retro-accent">${s.active_rooms || 0}</p>
            <p class="font-vt323 text-xs text-retro-text/50">Aktif Oda</p>
          </div>
          <div class="card-retro text-center p-4">
            <p class="font-pixel text-2xl text-retro-purple">${s.banned_users || 0}</p>
            <p class="font-vt323 text-xs text-retro-text/50">Banlı Kullanıcı</p>
          </div>
        </div>
      `;
    } catch (err) {
      el.innerHTML = `<p class="font-vt323 text-retro-accent">Hata: ${escapeHtml(err.message)}</p>`;
    }
  }

  // ======= USERS =======
  async function loadUsers() {
    const el = content();
    el.innerHTML = '<p class="font-vt323 text-retro-text/40">Kullanıcılar yükleniyor...</p>';

    try {
      const data = await Api.get('/admin/users?limit=50');
      const users = data.data || [];

      el.innerHTML = `
        <h2 class="font-pixel text-retro-accent text-sm mb-4">KULLANICILAR</h2>
        <div class="mb-4">
          <input type="text" id="user-search" class="input-retro text-sm" placeholder="Kullanıcı ara..." />
        </div>
        <div class="space-y-2" id="users-list">
          ${users.map(u => userRow(u)).join('')}
        </div>
        <div id="user-detail-panel"></div>
      `;

      // Arama
      document.getElementById('user-search')?.addEventListener('input', async (e) => {
        const q = e.target.value.trim();
        if (q.length < 2) return;
        try {
          const res = await Api.get(`/admin/users?search=${encodeURIComponent(q)}`);
          document.getElementById('users-list').innerHTML = (res.data || []).map(u => userRow(u)).join('');
          bindUserActions();
        } catch { /* ignore */ }
      });

      bindUserActions();
    } catch (err) {
      el.innerHTML = `<p class="font-vt323 text-retro-accent">Hata: ${escapeHtml(err.message)}</p>`;
    }
  }

  function userRow(u) {
    return `
      <div class="leaderboard-row cursor-pointer hover:bg-retro-accent/10 transition-colors" data-user-id="${u.id}">
        <div class="flex items-center gap-3">
          <div class="player-avatar text-xs">${(u.username || '?')[0].toUpperCase()}</div>
          <div>
            <p class="font-vt323">${escapeHtml(u.display_name || u.username)}</p>
            <p class="font-mono text-xs text-retro-text/40">${escapeHtml(u.email || '')} · Lv.${u.level || 1}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="badge-retro text-xs">${u.role}</span>
          ${u.is_banned ? '<span class="text-xs text-retro-accent">🚫 Banlı</span>' : ''}
          <button class="text-xs text-retro-accent hover:underline" data-ban-user="${u.id}" data-banned="${u.is_banned}">
            ${u.is_banned ? 'Unban' : 'Ban'}
          </button>
        </div>
      </div>
    `;
  }

  function bindUserActions() {
    document.querySelectorAll('[data-ban-user]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const userId = btn.dataset.banUser;
        const isBanned = btn.dataset.banned === 'true';
        try {
          if (isBanned) {
            await Api.post(`/admin/users/${userId}/unban`);
            Toast.success('Kullanıcı ban kaldırıldı');
          } else {
            await Api.post(`/admin/users/${userId}/ban`, { reason: 'Admin tarafından banlandı' });
            Toast.success('Kullanıcı banlandı');
          }
          loadUsers();
        } catch (err) {
          Toast.error(err.message);
        }
      });
    });

    // User detail click
    document.querySelectorAll('[data-user-id]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-ban-user]')) return;
        loadUserDetail(row.dataset.userId);
      });
    });
  }

  async function loadUserDetail(userId) {
    const panel = document.getElementById('user-detail-panel');
    if (!panel) return;
    panel.innerHTML = '<p class="font-vt323 text-retro-text/40 mt-4">Yükleniyor...</p>';

    try {
      const data = await Api.get(`/admin/users/${userId}`);
      const u = data.data;

      panel.innerHTML = `
        <div class="card-retro mt-4 p-4 border-retro-gold/30">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <div class="player-avatar text-lg">${(u.username || '?')[0].toUpperCase()}</div>
              <div>
                <h3 class="font-pixel text-xs text-retro-gold">${escapeHtml(u.display_name || u.username)}</h3>
                <p class="font-mono text-xs text-retro-text/40">@${escapeHtml(u.username)}</p>
              </div>
            </div>
            <button id="close-user-detail" class="text-xs text-retro-text/40 hover:text-retro-accent">✕ Kapat</button>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <p class="font-mono text-xs text-retro-text/40">Rol</p>
              <p class="font-vt323 text-sm">${u.role}</p>
            </div>
            <div>
              <p class="font-mono text-xs text-retro-text/40">Seviye</p>
              <p class="font-vt323 text-sm">Lv.${u.level || 1} (${u.xp || 0} XP)</p>
            </div>
            <div>
              <p class="font-mono text-xs text-retro-text/40">Toplam Oyun</p>
              <p class="font-vt323 text-sm">${u.total_games || 0}</p>
            </div>
            <div>
              <p class="font-mono text-xs text-retro-text/40">Toplam Galibiyet</p>
              <p class="font-vt323 text-sm">${u.total_wins || 0}</p>
            </div>
            <div>
              <p class="font-mono text-xs text-retro-text/40">E-posta</p>
              <p class="font-vt323 text-sm">${escapeHtml(u.email || '-')}</p>
            </div>
            <div>
              <p class="font-mono text-xs text-retro-text/40">Ban Durumu</p>
              <p class="font-vt323 text-sm">${u.is_banned ? '<span class="text-retro-accent">🚫 Banlı</span>' : '<span class="text-retro-green">Aktif</span>'}</p>
            </div>
            <div>
              <p class="font-mono text-xs text-retro-text/40">Kayıt Tarihi</p>
              <p class="font-vt323 text-sm">${new Date(u.created_at).toLocaleString('tr')}</p>
            </div>
            <div>
              <p class="font-mono text-xs text-retro-text/40">Son Giriş</p>
              <p class="font-vt323 text-sm">${u.last_login_at ? new Date(u.last_login_at).toLocaleString('tr') : '-'}</p>
            </div>
          </div>
        </div>
      `;

      document.getElementById('close-user-detail')?.addEventListener('click', () => {
        panel.innerHTML = '';
      });
    } catch (err) {
      panel.innerHTML = `<p class="font-vt323 text-retro-accent mt-4">Hata: ${escapeHtml(err.message)}</p>`;
    }
  }

  // ======= ROOMS =======
  async function loadRooms() {
    const el = content();
    try {
      const data = await Api.get('/admin/rooms');
      const rooms = data.data || [];

      el.innerHTML = `
        <h2 class="font-pixel text-retro-accent text-sm mb-4">ODALAR</h2>
        <div class="space-y-2" id="rooms-list">
          ${rooms.length === 0 ? '<p class="font-vt323 text-retro-text/40">Aktif oda yok</p>' : 
          rooms.map(r => `
            <div class="leaderboard-row cursor-pointer hover:bg-retro-accent/10 transition-colors" data-room-id="${r.id}">
              <div>
                <p class="font-vt323">${escapeHtml(r.name)} <span class="text-retro-gold font-mono text-sm">[${escapeHtml(r.code)}]</span></p>
                <p class="font-mono text-xs text-retro-text/40">${r.player_count || 0}/${r.max_players} · ${r.status}</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="font-vt323 text-xs text-retro-text/40">Detay →</span>
                <button class="btn-retro text-xs" data-close-room="${r.id}">KAPAT</button>
              </div>
            </div>
          `).join('')}
        </div>
        <div id="room-detail-panel"></div>
      `;

      // Room detail click
      document.querySelectorAll('[data-room-id]').forEach(row => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('[data-close-room]')) return;
          loadRoomDetail(row.dataset.roomId);
        });
      });

      document.querySelectorAll('[data-close-room]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            await Api.delete(`/admin/rooms/${btn.dataset.closeRoom}`);
            Toast.success('Oda kapatıldı');
            loadRooms();
          } catch (err) {
            Toast.error(err.message);
          }
        });
      });
    } catch (err) {
      el.innerHTML = `<p class="font-vt323 text-retro-accent">Hata: ${escapeHtml(err.message)}</p>`;
    }
  }

  async function loadRoomDetail(roomId) {
    const panel = document.getElementById('room-detail-panel');
    if (!panel) return;
    panel.innerHTML = '<p class="font-vt323 text-retro-text/40 mt-4">Yükleniyor...</p>';

    try {
      const data = await Api.get(`/admin/rooms/${roomId}`);
      const r = data.data;
      const players = r.players || [];
      const categories = r.categories || [];

      panel.innerHTML = `
        <div class="card-retro mt-4 p-4 border-retro-gold/30">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-pixel text-xs text-retro-gold">${escapeHtml(r.name)} [${escapeHtml(r.code)}]</h3>
            <button id="close-room-detail" class="text-xs text-retro-text/40 hover:text-retro-accent">✕ Kapat</button>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div>
              <p class="font-mono text-xs text-retro-text/40">Durum</p>
              <p class="font-vt323 text-sm">${r.status}</p>
            </div>
            <div>
              <p class="font-mono text-xs text-retro-text/40">Round</p>
              <p class="font-vt323 text-sm">${r.current_round || 0} / ${r.total_rounds}</p>
            </div>
            <div>
              <p class="font-mono text-xs text-retro-text/40">Süre (sn)</p>
              <p class="font-vt323 text-sm">${r.time_per_round}s</p>
            </div>
            <div>
              <p class="font-mono text-xs text-retro-text/40">Oylama (sn)</p>
              <p class="font-vt323 text-sm">${r.voting_timer}s</p>
            </div>
            <div>
              <p class="font-mono text-xs text-retro-text/40">Gizli</p>
              <p class="font-vt323 text-sm">${r.is_private ? 'Evet' : 'Hayır'}</p>
            </div>
            <div>
              <p class="font-mono text-xs text-retro-text/40">Cevap Modu</p>
              <p class="font-vt323 text-sm">${r.answer_reveal_mode || '-'}</p>
            </div>
            <div>
              <p class="font-mono text-xs text-retro-text/40">Oluşturma</p>
              <p class="font-vt323 text-sm">${new Date(r.created_at).toLocaleString('tr')}</p>
            </div>
            <div>
              <p class="font-mono text-xs text-retro-text/40">Son Aktivite</p>
              <p class="font-vt323 text-sm">${r.last_activity ? new Date(r.last_activity).toLocaleString('tr') : '-'}</p>
            </div>
          </div>

          ${categories.length > 0 ? `
            <div class="mb-4">
              <p class="font-mono text-xs text-retro-text/40 mb-1">Kategoriler</p>
              <div class="flex flex-wrap gap-1">
                ${categories.map(c => `<span class="badge-retro text-xs">${escapeHtml(c.name)}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          <div>
            <p class="font-mono text-xs text-retro-text/40 mb-2">Oyuncular (${players.length}/${r.max_players})</p>
            ${players.length === 0 ? '<p class="font-vt323 text-retro-text/30 text-sm">Oyuncu yok</p>' :
            `<div class="space-y-1">
              ${players.map(p => `
                <div class="flex items-center justify-between p-2 border border-retro-accent/10 rounded">
                  <div class="flex items-center gap-2">
                    <div class="player-avatar text-xs">${(p.username || '?')[0].toUpperCase()}</div>
                    <div>
                      <p class="font-vt323 text-sm">${escapeHtml(p.display_name || p.username)}</p>
                      <p class="font-mono text-xs text-retro-text/40">Lv.${p.level || 1}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    ${p.is_owner ? '<span class="text-xs text-retro-gold">👑 Kurucu</span>' : ''}
                    ${p.is_ready ? '<span class="text-xs text-retro-green">✓ Hazır</span>' : '<span class="text-xs text-retro-text/30">Bekliyor</span>'}
                    <span class="font-mono text-xs text-retro-accent">${p.total_score || 0} puan</span>
                  </div>
                </div>
              `).join('')}
            </div>`}
          </div>
        </div>
      `;

      document.getElementById('close-room-detail')?.addEventListener('click', () => {
        panel.innerHTML = '';
      });
    } catch (err) {
      panel.innerHTML = `<p class="font-vt323 text-retro-accent mt-4">Hata: ${escapeHtml(err.message)}</p>`;
    }
  }

  // ======= ANNOUNCEMENTS =======
  async function loadAnnouncements() {
    const el = content();
    el.innerHTML = '<p class="font-vt323 text-retro-text/40">Duyurular yükleniyor...</p>';

    // Aktif odaları çek (hedef seçimi için)
    let activeRooms = [];
    try {
      const roomData = await Api.get('/admin/rooms');
      activeRooms = roomData.data || [];
    } catch { /* ignore */ }

    el.innerHTML = `
      <h2 class="font-pixel text-retro-accent text-sm mb-4">DUYURULAR</h2>
      <div class="card-retro mb-6">
        <h3 class="font-pixel text-xs text-retro-gold mb-3">YENİ DUYURU</h3>
        <form id="announce-form" class="space-y-3">
          <input type="text" name="title" class="input-retro text-sm" placeholder="Başlık" required />
          <textarea name="content" class="input-retro text-sm" rows="3" placeholder="İçerik" required></textarea>
          <select name="target" id="announce-target" class="input-retro text-sm">
            <option value="all">Herkese</option>
            <option value="lobby">Lobiye</option>
            <option value="room">Belirli Odaya</option>
          </select>
          <div id="room-select-wrapper" class="hidden">
            <select name="targetRoomId" id="announce-room" class="input-retro text-sm">
              <option value="">Oda seçin...</option>
              ${activeRooms.map(r => `<option value="${r.id}">${escapeHtml(r.name)} [${escapeHtml(r.code)}] — ${r.player_count || 0}/${r.max_players} · ${r.status}</option>`).join('')}
            </select>
          </div>
          <button type="submit" class="btn-retro text-xs">GÖNDER</button>
        </form>
      </div>
      <div id="announcements-list">Yükleniyor...</div>
    `;

    // Hedef değiştiğinde oda seçicisini göster/gizle
    document.getElementById('announce-target').addEventListener('change', (e) => {
      const wrapper = document.getElementById('room-select-wrapper');
      wrapper.classList.toggle('hidden', e.target.value !== 'room');
    });

    document.getElementById('announce-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const target = e.target.target.value;
      const payload = {
        title: e.target.title.value,
        content: e.target.content.value,
        target,
      };
      if (target === 'room') {
        const roomId = e.target.targetRoomId.value;
        if (!roomId) {
          Toast.error('Lütfen bir oda seçin');
          return;
        }
        payload.targetRoomId = parseInt(roomId, 10);
      }
      try {
        await Api.post('/admin/announcements', payload);
        Toast.success('Duyuru gönderildi');
        e.target.reset();
        document.getElementById('room-select-wrapper').classList.add('hidden');
        loadAnnouncementList();
      } catch (err) {
        Toast.error(err.message);
      }
    });

    loadAnnouncementList();
  }

  async function loadAnnouncementList() {
    const el = document.getElementById('announcements-list');
    if (!el) return;
    try {
      const data = await Api.get('/admin/announcements');
      const announcements = data.data || [];
      el.innerHTML = announcements.length === 0 ? '<p class="font-vt323 text-retro-text/40">Duyuru yok</p>' :
        announcements.map(a => `
          <div class="leaderboard-row mb-2">
            <div>
              <p class="font-vt323">${escapeHtml(a.title)}</p>
              <p class="font-mono text-xs text-retro-text/40">${new Date(a.created_at).toLocaleDateString('tr')}</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="badge-retro text-xs">${a.target === 'room' && a.room_code ? `oda: ${a.room_code}` : a.target}</span>
              <button class="text-xs text-retro-accent hover:underline" data-delete-announcement="${a.id}">SİL</button>
            </div>
          </div>
        `).join('');

      document.querySelectorAll('[data-delete-announcement]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Bu duyuruyu silmek istediğinize emin misiniz?')) return;
          try {
            await Api.delete(`/admin/announcements/${btn.dataset.deleteAnnouncement}`);
            Toast.success('Duyuru silindi');
            loadAnnouncementList();
          } catch (err) {
            Toast.error(err.message);
          }
        });
      });
    } catch { el.innerHTML = '<p class="font-vt323 text-retro-accent">Yüklenemedi</p>'; }
  }

  // ======= LOGS =======
  async function loadLogs() {
    const el = content();
    try {
      const data = await Api.get('/admin/logs?limit=50');
      const logs = data.data || [];

      el.innerHTML = `
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-pixel text-retro-accent text-sm">ADMIN LOGLARI</h2>
          ${logs.length > 0 ? '<button id="clear-logs-btn" class="btn-retro text-xs">TEMİZLE</button>' : ''}
        </div>
        <div class="space-y-1">
          ${logs.length === 0 ? '<p class="font-vt323 text-retro-text/40">Log yok</p>' :
          logs.map(l => `
            <div class="p-2 border border-retro-accent/10 rounded font-mono text-xs">
              <span class="text-retro-gold">[${new Date(l.created_at).toLocaleString('tr')}]</span>
              <span class="text-retro-accent">${escapeHtml(l.action)}</span>
              <span class="text-retro-text/50">${escapeHtml(l.target_type || '')} ${l.target_id || ''}</span>
            </div>
          `).join('')}
        </div>
      `;

      document.getElementById('clear-logs-btn')?.addEventListener('click', async () => {
        if (!confirm('Tüm admin loglarını temizlemek istediğinize emin misiniz?')) return;
        try {
          await Api.delete('/admin/logs');
          Toast.success('Loglar temizlendi');
          loadLogs();
        } catch (err) {
          Toast.error(err.message);
        }
      });
    } catch (err) {
      el.innerHTML = `<p class="font-vt323 text-retro-accent">Hata: ${escapeHtml(err.message)}</p>`;
    }
  }

  // ======= REPORTS =======
  async function loadReports() {
    const el = content();
    try {
      const data = await Api.get('/admin/reports');
      const reports = data.data || [];

      el.innerHTML = `
        <h2 class="font-pixel text-retro-accent text-sm mb-4">RAPORLAR</h2>
        <div class="space-y-2">
          ${reports.length === 0 ? '<p class="font-vt323 text-retro-text/40">Rapor yok</p>' :
          reports.map(r => `
            <div class="card-retro p-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-vt323">${escapeHtml(r.reason || 'Rapor')}</p>
                  <p class="font-mono text-xs text-retro-text/40">
                    Raporlayan: ${r.reporter_id} · Hedef: ${r.reported_id}
                    · ${new Date(r.created_at).toLocaleDateString('tr')}
                  </p>
                </div>
                <span class="badge-retro text-xs">${r.status || 'pending'}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      el.innerHTML = `<p class="font-vt323 text-retro-accent">Hata: ${escapeHtml(err.message)}</p>`;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ======= CONTACT =======
  async function loadContact() {
    const el = content();
    el.innerHTML = '<p class="font-vt323 text-retro-text/40">İletişim mesajları yükleniyor...</p>';

    try {
      const [messagesRes, countRes] = await Promise.all([
        Api.get('/admin/contact?limit=50'),
        Api.get('/admin/contact/unread-count'),
      ]);
      const messages = messagesRes.data || [];
      const unreadCount = countRes.data?.count || 0;

      el.innerHTML = `
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-pixel text-retro-accent text-sm">İLETİŞİM MESAJLARI</h2>
          <span class="badge-retro text-xs">${unreadCount} okunmamış</span>
        </div>
        <div class="space-y-2" id="contact-list">
          ${messages.length === 0 ? '<p class="font-vt323 text-retro-text/40">Henüz mesaj yok</p>' :
          messages.map(m => `
            <div class="card-retro p-4 ${m.is_read ? 'opacity-60' : 'border-retro-gold/40'}">
              <div class="flex items-center justify-between mb-2">
                <div>
                  <p class="font-vt323 text-lg ${m.is_read ? 'text-retro-text/50' : 'text-retro-gold'}">${escapeHtml(m.subject)}</p>
                  <p class="font-mono text-xs text-retro-text/40">
                    ${escapeHtml(m.name)} &middot; ${escapeHtml(m.email)} &middot; ${new Date(m.created_at).toLocaleString('tr')}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  ${m.is_read
                    ? '<span class="badge-retro text-xs bg-retro-green/20 text-retro-green">✓ Okundu</span>'
                    : `<button class="btn-retro text-xs" data-read-contact="${m.id}">OKUNDU</button>`
                  }
                  <button class="text-xs text-retro-accent hover:underline" data-delete-contact="${m.id}">SİL</button>
                </div>
              </div>
              <p class="font-vt323 text-sm text-retro-text/70 whitespace-pre-wrap">${escapeHtml(m.message)}</p>
              ${m.is_read && m.read_by_username ? `<p class="font-mono text-xs text-retro-text/30 mt-2">Okuyan: ${escapeHtml(m.read_by_username)} — ${new Date(m.read_at).toLocaleString('tr')}</p>` : ''}
            </div>
          `).join('')}
        </div>
      `;

      document.querySelectorAll('[data-read-contact]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await Api.post(`/admin/contact/${btn.dataset.readContact}/read`);
            Toast.success('Mesaj okundu olarak işaretlendi');
            loadContact();
          } catch (err) {
            Toast.error(err.message);
          }
        });
      });

      document.querySelectorAll('[data-delete-contact]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Bu mesajı silmek istediğinize emin misiniz?')) return;
          try {
            await Api.delete(`/admin/contact/${btn.dataset.deleteContact}`);
            Toast.success('Mesaj silindi');
            loadContact();
          } catch (err) {
            Toast.error(err.message);
          }
        });
      });
    } catch (err) {
      el.innerHTML = `<p class="font-vt323 text-retro-accent">Hata: ${escapeHtml(err.message)}</p>`;
    }
  }

  // Başlat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init };
})();
