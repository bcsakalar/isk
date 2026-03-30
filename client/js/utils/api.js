// API Utility — fetch wrapper with auth & refresh
const Api = (() => {
  const BASE = '/api';

  async function request(method, path, body, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = Store.get('token');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const config = { method, headers };
    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    let res = await fetch(`${BASE}${path}`, config);

    // Token expired — refresh & retry (sadece oturum açıkken)
    if (res.status === 401 && !options._retried && token) {
      // Misafirler için refresh token yok — direkt auth'a yönlendir
      if (Store.isGuest()) {
        Store.clearAuth();
        Router.navigate('/auth');
        throw new Error('Misafir oturumu sona erdi');
      }

      const refreshed = await refreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${Store.get('token')}`;
        config.headers = headers;
        res = await fetch(`${BASE}${path}`, config);
      } else {
        Store.clearAuth();
        Router.navigate('/auth');
        throw new Error('Oturum süresi doldu');
      }
    }

    const data = await res.json();
    if (!res.ok) {
      // Rate limit veya diğer hata formatları: { error: '...' } veya { message: '...' }
      const errMsg = data.message || data.error || 'Bir hata oluştu';
      throw new Error(errMsg);
    }
    return data;
  }

  async function refreshToken() {
    const rt = Store.get('refreshToken');
    if (!rt) return false;

    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) return false;

      const data = await res.json();
      Store.saveAuth(data.data.user, data.data.accessToken, data.data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    patch: (path, body) => request('PATCH', path, body),
    delete: (path) => request('DELETE', path),
  };
})();
