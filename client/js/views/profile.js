// Profile View — Kullanıcı Profil Ekranı
function ProfileView(container) {

  async function render() {
    // Misafir kontrolü
    if (Store.isGuest()) {
      container.innerHTML = `
        <div class="max-w-md mx-auto mt-8 text-center">
          <div class="card-retro p-8">
            <p class="font-pixel text-retro-accent text-sm mb-4">PROFİL</p>
            <p class="font-vt323 text-lg text-retro-text/60 mb-4">Bu sayfa sadece kayıtlı kullanıcılar için.</p>
            <a href="/auth" data-link class="btn-retro text-xs">KAYIT OL</a>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="max-w-2xl mx-auto space-y-6">
        <div class="text-center">
          <h2 class="font-pixel text-retro-accent text-sm">PROFİL</h2>
        </div>
        <div id="profile-content">
          <p class="text-center font-vt323 text-retro-text/40">Yükleniyor...</p>
        </div>
      </div>
    `;

    try {
      const data = await Api.get('/users/me');
      renderProfile(data.data);
    } catch (err) {
      document.getElementById('profile-content').innerHTML = `
        <p class="text-center font-vt323 text-retro-accent">${err.message}</p>
      `;
    }
  }

  function renderProfile(user) {
    const el = document.getElementById('profile-content');
    if (!el) return;

    const xpForNext = user.level * 100;
    const xpProgress = user.total_xp ? Math.min((user.total_xp % 100) / 100 * 100, 100) : 0;

    el.innerHTML = `
      <!-- Profil Kartı -->
      <div class="card-retro text-center py-8">
        <div class="player-avatar w-14 h-14 sm:w-20 sm:h-20 text-xl sm:text-3xl mx-auto">
          ${(user.display_name || user.username)[0].toUpperCase()}
        </div>
        <h3 class="font-pixel text-retro-accent text-sm mt-4">${escapeHtml(user.display_name || user.username)}</h3>
        <p class="font-mono text-xs text-retro-text/40 mt-1">@${escapeHtml(user.username)}</p>
        
        <!-- Level -->
        <div class="mt-4">
          <span class="badge-retro text-sm">Seviye ${user.level || 1}</span>
          <div class="timer-bar mx-auto mt-2 max-w-xs">
            <div class="timer-bar-fill" style="width: ${xpProgress}%"></div>
          </div>
          <p class="font-mono text-xs text-retro-text/40 mt-1">${user.total_xp || 0} XP</p>
        </div>
      </div>

      <!-- İstatistikler -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        <div class="card-retro text-center p-4">
          <p class="font-pixel text-lg text-retro-gold">${user.games_played || 0}</p>
          <p class="font-vt323 text-xs text-retro-text/50">Oyun</p>
        </div>
        <div class="card-retro text-center p-4">
          <p class="font-pixel text-lg text-retro-green">${user.games_won || 0}</p>
          <p class="font-vt323 text-xs text-retro-text/50">Galibiyet</p>
        </div>
        <div class="card-retro text-center p-4">
          <p class="font-pixel text-lg text-retro-accent">${user.total_score || 0}</p>
          <p class="font-vt323 text-xs text-retro-text/50">Skor</p>
        </div>
        <div class="card-retro text-center p-4">
          <p class="font-pixel text-lg text-retro-purple">
            ${user.games_played > 0 ? Math.round((user.games_won / user.games_played) * 100) : 0}%
          </p>
          <p class="font-vt323 text-xs text-retro-text/50">Kazanma</p>
        </div>
      </div>

      <!-- Profil Düzenleme -->
      <div class="card-retro mt-6">
        <h4 class="font-pixel text-xs text-retro-gold mb-3">PROFİLİ DÜZENLE</h4>
        <form id="profile-form" class="space-y-3">
          <div>
            <label class="font-vt323 text-sm text-retro-text/70 block mb-1">Görünen İsim</label>
            <input type="text" name="displayName" class="input-retro text-sm" value="${escapeAttr(user.display_name || '')}" placeholder="Görünen isim..." maxlength="30" />
          </div>
          <div id="profile-error" class="text-retro-accent font-vt323 text-sm hidden"></div>
          <button type="submit" class="btn-retro text-xs">KAYDET</button>
        </form>
      </div>

      <!-- Başarımlar -->
      <div class="card-retro mt-6">
        <h4 class="font-pixel text-xs text-retro-gold mb-3">BAŞARIMLAR</h4>
        <div id="achievements-list" class="grid grid-cols-2 gap-2">
          <p class="font-vt323 text-retro-text/40 col-span-2">Başarımlar yükleniyor...</p>
        </div>
      </div>

      <!-- KVKK & Veri Yönetimi -->
      <div class="card-retro mt-6">
        <h4 class="font-pixel text-xs text-retro-gold mb-3">VERİ YÖNETİMİ (KVKK)</h4>
        <div class="space-y-3">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="font-vt323 text-sm text-retro-text">Verilerimi İndir</p>
              <p class="font-mono text-xs text-retro-text/40">Tüm kişisel verilerinizi JSON formatında indirin</p>
            </div>
            <button id="btn-export-data" class="btn-retro-outline text-xs self-start sm:self-auto">İNDİR</button>
          </div>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="font-vt323 text-sm text-retro-text">Gizlilik Politikası</p>
              <p class="font-mono text-xs text-retro-text/40">KVKK aydınlatma metni ve gizlilik politikası</p>
            </div>
            <a href="/privacy" data-link class="btn-retro-outline text-xs self-start sm:self-auto">GÖRÜNTÜLE</a>
          </div>
          <div class="border-t border-retro-accent/20 pt-3">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="font-vt323 text-sm text-retro-accent">Hesabımı Sil</p>
                <p class="font-mono text-xs text-retro-text/40">30 gün sonra kalıcı olarak silinir</p>
              </div>
              <button id="btn-delete-account" class="btn-retro text-xs bg-red-900/30 border-red-500 hover:bg-red-900/50 self-start sm:self-auto">SİL</button>
            </div>
            <div id="deletion-status" class="hidden mt-2"></div>
          </div>
        </div>
      </div>
    `;

    // Form handler
    document.getElementById('profile-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('profile-error');
      try {
        const displayName = e.target.displayName.value.trim();
        await Api.put('/users/me', { displayName });
        Store.update('user', u => ({ ...u, display_name: displayName }));
        localStorage.setItem('isk_user', JSON.stringify(Store.get('user')));
        Toast.success('Profil güncellendi!');
        Router.updateNav();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
    });

    // Başarımları yükle
    loadAchievements();

    // KVKK: Veri dışa aktarma
    document.getElementById('btn-export-data')?.addEventListener('click', async () => {
      try {
        const data = await Api.get('/kvkk/export');
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'verilerim.json';
        a.click();
        URL.revokeObjectURL(url);
        Toast.success('Verileriniz indirildi');
      } catch (err) {
        Toast.error(err.message);
      }
    });

    // KVKK: Hesap silme
    document.getElementById('btn-delete-account')?.addEventListener('click', () => {
      Modal.confirm({
        title: 'HESABI SİL',
        message: 'Hesabınız 30 gün sonra kalıcı olarak silinecektir. Bu süre içinde iptal edebilirsiniz. Devam etmek istiyor musunuz?',
        onConfirm: async () => {
          try {
            await Api.post('/kvkk/request-deletion');
            Toast.info('Hesap silme talebi oluşturuldu. 30 gün içinde iptal edebilirsiniz.');
            loadDeletionStatus();
          } catch (err) {
            Toast.error(err.message);
          }
        },
      });
    });

    // Silme durumunu kontrol et
    loadDeletionStatus();
  }

  async function loadDeletionStatus() {
    const el = document.getElementById('deletion-status');
    if (!el) return;
    try {
      const data = await Api.get('/kvkk/privacy-status');
      if (data.data.deletionRequested) {
        el.classList.remove('hidden');
        el.innerHTML = `
          <div class="flex items-center justify-between p-2 bg-red-900/20 rounded border border-red-500/30">
            <p class="font-vt323 text-xs text-red-400">Hesap silme talebi aktif</p>
            <button id="btn-cancel-deletion" class="font-vt323 text-xs text-retro-green underline hover:text-retro-gold">İPTAL ET</button>
          </div>
        `;
        document.getElementById('btn-cancel-deletion')?.addEventListener('click', async () => {
          try {
            await Api.post('/kvkk/cancel-deletion');
            Toast.success('Silme talebi iptal edildi');
            el.classList.add('hidden');
          } catch (err) {
            Toast.error(err.message);
          }
        });
      }
    } catch {
      // Sessiz başarısızlık
    }
  }

  async function loadAchievements() {
    const el = document.getElementById('achievements-list');
    if (!el) return;

    try {
      const data = await Api.get('/users/me/achievements');
      const achievements = data.data || [];

      if (achievements.length === 0) {
        el.innerHTML = '<p class="font-vt323 text-retro-text/40 col-span-2">Henüz başarım yok</p>';
        return;
      }

      el.innerHTML = achievements.map(a => `
        <div class="flex items-center gap-2 p-2 rounded border border-retro-accent/20 ${a.earned ? 'bg-retro-accent/10' : 'opacity-40'}">
          <span class="text-xl">${a.icon || '🏅'}</span>
          <div>
            <p class="font-vt323 text-sm">${escapeHtml(a.name)}</p>
            <p class="font-mono text-xs text-retro-text/40">${escapeHtml(a.description || '')}</p>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.warn('Achievements load failed:', err.message);
      el.innerHTML = '<p class="font-vt323 text-retro-text/40 col-span-2">Yüklenemedi</p>';
    }
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

  return { destroy() {} };
}

Router.register('/profile', (container) => {
  if (!Store.get('user')) {
    Router.navigate('/auth');
    return { destroy() {} };
  }
  return ProfileView(container);
});
