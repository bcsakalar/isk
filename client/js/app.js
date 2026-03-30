// App — Ana Uygulama Başlatıcı
const App = (() => {
  function init() {
    // Auth guard
    Router.addBeforeHook((path) => {
      const publicPaths = ['/auth', '/leaderboard', '/contact', '/error', '/404', '/', '/privacy'];
      const user = Store.get('user');

      // Allow invite pages without auth
      if (!user && !publicPaths.includes(path) && !path.startsWith('/invite/')) {
        Router.navigate('/auth');
        return false;
      }

      // Misafir kullanıcılar profil sayfasına giremez
      if (user && Store.isGuest() && path === '/profile') {
        Toast.info('Profil sayfası sadece kayıtlı kullanıcılar için');
        Router.navigate('/');
        return false;
      }

      // Kayıtlı kullanıcı auth sayfasına gitmesin, ama misafir gidebilsin (kayıt olmak için)
      if (user && !Store.isGuest() && path === '/auth') {
        Router.navigate('/');
        return false;
      }

      return true;
    });

    // Socket bağlantısı
    if (Store.get('token')) {
      SocketClient.connect();
    }

    // Bildirim sistemi başlat
    Notification.init();

    // İlk route çözümle
    Router.resolve();

    console.log('[App] İsim Şehir Katman başlatıldı');
  }

  function logout() {
    Api.post('/auth/logout').catch((err) => {
      console.warn('Logout API failed:', err.message);
    });
    SocketClient.disconnect();
    Store.clearAuth();
    Store.set('currentRoom', null);
    Store.set('currentRound', null);
    Store.set('gameState', 'idle');
    Router.navigate('/');
    Toast.info('Çıkış yapıldı');
  }

  // DOM hazır olunca başlat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { logout, init };
})();
