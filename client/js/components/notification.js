// Notification Component — Duyuru ve bildirim banner'ları
const Notification = (() => {
  let hideTimeout = null;

  function showAnnouncement(title, content) {
    const banner = document.getElementById('announcement-banner');
    if (!banner) return;

    // Temizle
    if (hideTimeout) clearTimeout(hideTimeout);

    banner.innerHTML = `
      <div class="flex items-center justify-center gap-3">
        <span>📢 <strong>${escapeText(title)}</strong>: ${escapeText(content)}</span>
        <button id="close-announcement" class="ml-2 font-bold hover:opacity-70">✕</button>
      </div>
    `;
    banner.classList.remove('hidden');

    document.getElementById('close-announcement')?.addEventListener('click', () => {
      banner.classList.add('hidden');
      if (hideTimeout) clearTimeout(hideTimeout);
    });

    hideTimeout = setTimeout(() => {
      banner.classList.add('hidden');
    }, 15000);
  }

  function escapeText(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function init() {
    SocketClient.on('announcement', (data) => {
      showAnnouncement(data.title, data.content);
    });

    SocketClient.on('room:kicked', (data) => {
      Toast.error(data.reason || 'Odadan çıkarıldınız');
      Router.navigate('/');
    });

    SocketClient.on('room:closed', (data) => {
      Toast.error(data.reason || 'Oda kapatıldı');
      Router.navigate('/');
    });

  }

  return { showAnnouncement, init };
})();
