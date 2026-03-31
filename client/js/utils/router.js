// History API SPA Router
const Router = (() => {
  const routes = {};
  let currentView = null;
  let beforeHooks = [];

  // SEO: Sayfa başına title ve description
  const pageMeta = {
    '/': { title: 'İsim Şehir Katman — Multiplayer Kelime Oyunu', description: 'Arkadaşlarınla gerçek zamanlı oynayabileceğin retro tarzında çok oyunculu kelime oyunu.' },
    '/auth': { title: 'Giriş Yap — İsim Şehir Katman', description: 'İsim Şehir Katman oyununa giriş yap veya kayıt ol.' },
    '/leaderboard': { title: 'Sıralama — İsim Şehir Katman', description: 'En iyi oyuncuları gör, sıralamada yerini al.' },
    '/profile': { title: 'Profil — İsim Şehir Katman', description: 'Profilini düzenle, istatistiklerini gör.' },
    '/privacy': { title: 'Gizlilik Politikası — İsim Şehir Katman', description: 'KVKK aydınlatma metni ve gizlilik politikası.' },
    '/contact': { title: 'İletişim — İsim Şehir Katman', description: 'Soru, öneri veya şikâyetleriniz için bize ulaşın.' },
    '/error': { title: 'Hata — İsim Şehir Katman', description: 'Bir hata oluştu.' },
    '/404': { title: 'Sayfa Bulunamadı — İsim Şehir Katman', description: 'Aradığınız sayfa bulunamadı.' },
  };

  function updateMeta(path) {
    const meta = pageMeta[path] || pageMeta['/'];
    document.title = meta.title;
    const descEl = document.querySelector('meta[name="description"]');
    if (descEl) descEl.setAttribute('content', meta.description);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', meta.title);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', meta.description);
  }

  function register(path, viewFn) {
    routes[path] = viewFn;
  }

  function navigate(path) {
    history.pushState(null, '', path);
    resolve();
  }

  function addBeforeHook(fn) {
    beforeHooks.push(fn);
  }

  function getCurrentPath() {
    return window.location.pathname || '/';
  }

  async function resolve() {
    const fullPath = getCurrentPath();
    const [path, queryStr] = fullPath.split('?');
    const params = new URLSearchParams(queryStr || window.location.search || '');

    // Before hooks (auth guard vb.)
    for (const hook of beforeHooks) {
      const result = hook(path, params);
      if (result === false) return;
    }

    // Parametre eşle: /room/:code -> /room/ABC123
    let matchedRoute = null;
    let routeParams = {};

    for (const [pattern, viewFn] of Object.entries(routes)) {
      const match = matchRoute(pattern, path);
      if (match) {
        matchedRoute = viewFn;
        routeParams = match;
        break;
      }
    }

    if (!matchedRoute) {
      matchedRoute = routes['/404'] || routes['/'];
    }

    if (matchedRoute) {
      if (currentView && typeof currentView.destroy === 'function') {
        currentView.destroy();
      }

      const container = document.getElementById('app-content');
      container.innerHTML = '';

      currentView = await matchedRoute(container, { params: routeParams, query: params });
    }

    updateMeta(path);
    updateNav();
  }

  function matchRoute(pattern, path) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) return null;

    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }

    return params;
  }

  function updateNav() {
    const nav = document.getElementById('nav-menu');
    if (!nav) return;

    const user = Store.get('user');
    const currentPath = getCurrentPath();

    if (user) {
      const isGuest = Store.isGuest();
      nav.innerHTML = `
        <a href="/" data-link class="font-vt323 text-sm ${currentPath === '/' ? 'text-retro-accent' : 'text-retro-text/70 hover:text-retro-accent'} transition-colors">Lobi</a>
        <a href="/leaderboard" data-link class="font-vt323 text-sm ${currentPath === '/leaderboard' ? 'text-retro-accent' : 'text-retro-text/70 hover:text-retro-accent'} transition-colors">Sıralama</a>
        ${isGuest ? '' : `<a href="/profile" data-link class="font-vt323 text-sm ${currentPath === '/profile' ? 'text-retro-accent' : 'text-retro-text/70 hover:text-retro-accent'} transition-colors">Profil</a>`}
        <a href="/contact" data-link class="font-vt323 text-sm ${currentPath === '/contact' ? 'text-retro-accent' : 'text-retro-text/70 hover:text-retro-accent'} transition-colors">İletişim</a>
        <div class="flex items-center gap-1.5">
          <span class="player-avatar text-xs">${(user.display_name || user.username)[0].toUpperCase()}</span>
          <span class="font-vt323 text-sm text-retro-gold">${escapeHtml(user.display_name || user.username)}</span>
          ${isGuest ? '<span class="badge-retro text-[0.6rem] bg-retro-green/20 text-retro-green">Misafir</span>' : `<span class="badge-retro text-[0.6rem]">Lv.${user.level || 1}</span>`}
        </div>
        ${isGuest ? '<a href="/auth" data-link class="font-vt323 text-xs text-retro-green hover:text-retro-accent transition-colors">Kayıt Ol</a>' : ''}
        <button id="btn-logout" class="font-vt323 text-xs text-retro-text/50 hover:text-retro-accent transition-colors">Çıkış</button>
      `;
      document.getElementById('btn-logout').addEventListener('click', () => App.logout());
    } else {
      nav.innerHTML = `
        <a href="/" data-link class="font-vt323 text-sm ${currentPath === '/' ? 'text-retro-accent' : 'text-retro-text/70 hover:text-retro-accent'} transition-colors">Lobi</a>
        <a href="/leaderboard" data-link class="font-vt323 text-sm ${currentPath === '/leaderboard' ? 'text-retro-accent' : 'text-retro-text/70 hover:text-retro-accent'} transition-colors">Sıralama</a>
        <a href="/contact" data-link class="font-vt323 text-sm ${currentPath === '/contact' ? 'text-retro-accent' : 'text-retro-text/70 hover:text-retro-accent'} transition-colors">İletişim</a>
        <a href="/auth" data-link class="btn-retro text-[0.6rem]">Giriş Yap</a>
      `;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // data-link attribute'lu tüm <a> tag'lerini yakala
  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[data-link]');
    if (anchor) {
      e.preventDefault();
      const href = anchor.getAttribute('href');
      if (href && href !== getCurrentPath()) {
        navigate(href);
      }
    }
  });

  // Dinle
  window.addEventListener('popstate', resolve);
  window.addEventListener('DOMContentLoaded', resolve);

  return { register, navigate, resolve, addBeforeHook, getCurrentPath, updateNav };
})();
