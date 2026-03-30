// Leaderboard View — Global Sıralama
function LeaderboardView(container) {
  let currentPeriod = 'all';

  async function render() {
    container.innerHTML = `
      <div class="max-w-2xl mx-auto space-y-6">
        <div class="text-center">
          <h2 class="font-pixel text-retro-accent text-sm">SIRALAMA</h2>
        </div>

        <!-- Periyot Seçimi -->
        <div class="flex justify-center gap-2">
          <button class="btn-retro text-xs ${currentPeriod === 'all' ? '' : 'opacity-50'}" data-period="all">TÜM ZAMANLAR</button>
          <button class="btn-retro text-xs ${currentPeriod === 'weekly' ? '' : 'opacity-50'}" data-period="weekly">HAFTALIK</button>
        </div>

        <!-- Leaderboard -->
        <div class="card-retro" id="leaderboard-content">
          <p class="text-center font-vt323 text-retro-text/40">Yükleniyor...</p>
        </div>
      </div>
    `;

    // Periyot butonları
    container.querySelectorAll('[data-period]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPeriod = btn.dataset.period;
        render();
      });
    });

    await loadLeaderboard();
  }

  async function loadLeaderboard() {
    const el = document.getElementById('leaderboard-content');
    if (!el) return;

    try {
      const data = await Api.get(`/leaderboard?period=${currentPeriod}&limit=50`);
      const entries = data.data || [];
      const user = Store.get('user');

      if (entries.length === 0) {
        el.innerHTML = '<p class="text-center font-vt323 text-retro-text/40 py-8">Henüz sıralama yok</p>';
        return;
      }

      el.innerHTML = `
        <div class="space-y-2">
          ${entries.map((entry, i) => `
            <div class="leaderboard-row ${entry.id === user?.id ? 'border-retro-gold border-2 bg-retro-gold/10' : ''}">
              <div class="flex items-center gap-3">
                <span class="font-pixel text-sm w-8 text-center
                  ${i === 0 ? 'text-retro-gold' : i === 1 ? 'text-retro-text/70' : i === 2 ? 'text-retro-accent' : 'text-retro-text/40'}">
                  ${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </span>
                <div class="player-avatar text-xs">${(entry.display_name || entry.username || '?')[0].toUpperCase()}</div>
                <div>
                  <p class="font-vt323 text-base">${escapeHtml(entry.display_name || entry.username)}</p>
                  <p class="font-mono text-xs text-retro-text/40">Lv.${entry.level || 1} · ${entry.games_played || entry.total_games || 0} oyun</p>
                </div>
              </div>
              <div class="text-right">
                <p class="font-pixel text-sm text-retro-accent">${entry.total_xp || entry.score || 0}</p>
                <p class="font-mono text-xs text-retro-text/40">XP</p>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      el.innerHTML = `<p class="text-center font-vt323 text-retro-accent py-8">${err.message}</p>`;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  render();

  return { destroy() {} };
}

Router.register('/leaderboard', (container) => {
  return LeaderboardView(container);
});
