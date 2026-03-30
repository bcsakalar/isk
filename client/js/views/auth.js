// Auth View — Giriş & Kayıt Ekranı
function AuthView(container) {
  let mode = 'login'; // login | register | guest

  function render() {
    container.innerHTML = `
      <div class="max-w-md mx-auto mt-8">
        <div class="text-center mb-8">
          <h1 class="font-pixel text-retro-accent text-xl mb-2">İSİM ŞEHİR</h1>
          <h2 class="font-pixel text-retro-gold text-sm">KATMAN</h2>
          <p class="font-vt323 text-retro-text/60 mt-4 text-lg">Retro kelime savaşına hoş geldin!</p>
        </div>

        <div class="card-retro">
          <!-- Tab Switch -->
          <div class="flex mb-6 border-b-2 border-retro-accent/20">
            <button id="tab-login" class="flex-1 py-3 font-pixel text-xs text-center transition-colors ${mode === 'login' ? 'text-retro-accent border-b-2 border-retro-accent' : 'text-retro-text/50'}">GİRİŞ YAP</button>
            <button id="tab-register" class="flex-1 py-3 font-pixel text-xs text-center transition-colors ${mode === 'register' ? 'text-retro-accent border-b-2 border-retro-accent' : 'text-retro-text/50'}">KAYIT OL</button>
          </div>

          ${mode === 'guest' ? '' : `
          <form id="auth-form" class="space-y-4">
            <div id="username-field">
              <label class="font-vt323 text-sm text-retro-text/70 mb-1 block">Kullanıcı Adı</label>
              <input type="text" name="username" class="input-retro" placeholder="kullanici_adi" autocomplete="username" required />
            </div>

            <div>
              <label class="font-vt323 text-sm text-retro-text/70 mb-1 block">Şifre</label>
              <input type="password" name="password" class="input-retro" placeholder="••••••" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" required />
            </div>

            <div id="password-confirm-field" class="${mode === 'login' ? 'hidden' : ''}">
              <label class="font-vt323 text-sm text-retro-text/70 mb-1 block">Şifre Tekrar</label>
              <input type="password" name="passwordConfirm" class="input-retro" placeholder="••••••" autocomplete="new-password" />
            </div>

            <div id="kvkk-field" class="${mode === 'login' ? 'hidden' : ''}">
              <label class="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" name="kvkkConsent" class="mt-1 accent-retro-accent" />
                <span class="font-vt323 text-xs text-retro-text/60">
                  <a href="/privacy" data-link class="text-retro-accent underline hover:text-retro-gold">Gizlilik Politikası</a> ve
                  <a href="/privacy" data-link class="text-retro-accent underline hover:text-retro-gold">KVKK Aydınlatma Metni</a>'ni okudum, kabul ediyorum.
                </span>
              </label>
            </div>

            <div id="auth-error" class="text-retro-accent font-vt323 text-sm hidden"></div>

            <button type="submit" id="auth-submit" class="btn-retro w-full">
              ${mode === 'login' ? 'GİRİŞ YAP' : 'KAYIT OL'}
            </button>
          </form>
          `}

          <!-- Misafir Giriş -->
          <div class="mt-6 pt-4 border-t-2 border-retro-accent/10">
            ${mode === 'guest' ? `
            <form id="guest-form" class="space-y-4">
              <div>
                <label class="font-vt323 text-sm text-retro-text/70 mb-1 block">Takma Ad</label>
                <input type="text" name="nickname" class="input-retro" placeholder="Takma adınız..." maxlength="15" required />
              </div>
              <div id="guest-error" class="text-retro-accent font-vt323 text-sm hidden"></div>
              <button type="submit" id="guest-submit" class="btn-retro w-full bg-retro-green/20 border-retro-green hover:bg-retro-green/40">MİSAFİR GİR</button>
              <button type="button" id="btn-back-login" class="w-full text-center font-vt323 text-sm text-retro-text/50 hover:text-retro-accent transition-colors mt-2">← Giriş / Kayıt</button>
            </form>
            ` : `
            <p class="font-vt323 text-sm text-retro-text/40 text-center mb-3">veya</p>
            <button id="btn-guest" class="btn-retro-outline w-full text-xs border-retro-green text-retro-green hover:bg-retro-green/10">👤 MİSAFİR OLARAK OYNA</button>
            <p class="font-vt323 text-xs text-retro-text/30 text-center mt-2">Kayıt olmadan hızlıca oyna — istatistikler kaydedilmez</p>
            `}
          </div>
        </div>
      </div>
    `;

    if (mode !== 'guest') {
      document.getElementById('auth-form').addEventListener('submit', handleSubmit);
    }
    if (mode === 'guest') {
      document.getElementById('guest-form').addEventListener('submit', handleGuestSubmit);
      document.getElementById('btn-back-login').addEventListener('click', () => { mode = 'login'; render(); });
    }
    document.getElementById('tab-login')?.addEventListener('click', () => { mode = 'login'; render(); });
    document.getElementById('tab-register')?.addEventListener('click', () => { mode = 'register'; render(); });
    document.getElementById('btn-guest')?.addEventListener('click', () => { mode = 'guest'; render(); });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const errorEl = document.getElementById('auth-error');
    const submitBtn = document.getElementById('auth-submit');

    errorEl.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Bekle...';

    try {
      const username = form.username.value.trim();
      const password = form.password.value;

      if (mode === 'login') {
        const usernameErr = Validators.username(username);
        if (usernameErr) throw new Error(usernameErr);
        const passErr = Validators.password(password);
        if (passErr) throw new Error(passErr);

        const data = await Api.post('/auth/login', { username, password });
        Store.saveAuth(data.data.user, data.data.accessToken, data.data.refreshToken);
        SocketClient.connect();
        Toast.success('Hoş geldin!');
        const pendingInvite = Store.get('pendingInvite');
        Store.set('pendingInvite', null);
        Router.navigate(pendingInvite ? `/invite/${pendingInvite}` : '/');
      } else {
        const passwordConfirm = form.passwordConfirm.value;
        const kvkkConsent = form.kvkkConsent?.checked;

        const usernameErr = Validators.username(username);
        if (usernameErr) throw new Error(usernameErr);
        const passErr = Validators.password(password);
        if (passErr) throw new Error(passErr);
        if (password !== passwordConfirm) throw new Error('Şifreler eşleşmiyor');
        if (!kvkkConsent) throw new Error('Gizlilik politikasını kabul etmelisiniz');

        const data = await Api.post('/auth/register', { username, password });
        Store.saveAuth(data.data.user, data.data.accessToken, data.data.refreshToken);
        // KVKK onayını kaydet
        Api.post('/kvkk/accept-privacy').catch(() => {});
        SocketClient.connect();
        Toast.success('Kayıt başarılı!');
        const pendingInvite = Store.get('pendingInvite');
        Store.set('pendingInvite', null);
        Router.navigate(pendingInvite ? `/invite/${pendingInvite}` : '/');
      }
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = mode === 'login' ? 'GİRİŞ YAP' : 'KAYIT OL';
    }
  }

  async function handleGuestSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const errorEl = document.getElementById('guest-error');
    const submitBtn = document.getElementById('guest-submit');

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
      const pendingInvite = Store.get('pendingInvite');
      Store.set('pendingInvite', null);
      Router.navigate(pendingInvite ? `/invite/${pendingInvite}` : '/');
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'MİSAFİR GİR';
    }
  }

  render();

  return {
    destroy() {},
    setMode(m) {
      mode = m;
      render();
    },
  };
}

Router.register('/auth', (container) => {
  return AuthView(container);
});
