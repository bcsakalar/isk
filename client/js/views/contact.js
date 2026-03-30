// Contact View — İletişim Formu
function ContactView(container) {
  let submitted = false;

  function render() {
    if (submitted) {
      container.innerHTML = `
        <div class="max-w-lg mx-auto mt-8">
          <div class="card-retro text-center py-12">
            <p class="font-pixel text-retro-green text-sm mb-4">✓ MESAJINIZ GÖNDERİLDİ</p>
            <p class="font-vt323 text-retro-text/70 text-lg">Teşekkür ederiz! En kısa sürede dönüş yapacağız.</p>
            <a href="/" data-link class="btn-retro mt-6 inline-block text-xs">← ANASAYFA</a>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="max-w-lg mx-auto mt-8">
        <div class="text-center mb-6">
          <h1 class="font-pixel text-retro-accent text-sm">İLETİŞİM</h1>
          <p class="font-vt323 text-retro-text/60 mt-2">Soru, öneri veya şikayetiniz mi var? Bize yazın!</p>
        </div>

        <div class="card-retro">
          <form id="contact-form" class="space-y-4">
            <div>
              <label class="font-vt323 text-sm text-retro-text/70 mb-1 block">İsim</label>
              <input type="text" name="name" class="input-retro" placeholder="Adınız..." minlength="2" maxlength="100" required />
            </div>

            <div>
              <label class="font-vt323 text-sm text-retro-text/70 mb-1 block">E-posta</label>
              <input type="email" name="email" class="input-retro" placeholder="mail@ornek.com" maxlength="255" required />
            </div>

            <div>
              <label class="font-vt323 text-sm text-retro-text/70 mb-1 block">Konu</label>
              <input type="text" name="subject" class="input-retro" placeholder="Konu başlığı..." minlength="2" maxlength="200" required />
            </div>

            <div>
              <label class="font-vt323 text-sm text-retro-text/70 mb-1 block">Mesaj</label>
              <textarea name="message" class="input-retro" rows="5" placeholder="Mesajınızı yazın..." minlength="10" maxlength="2000" required></textarea>
              <p class="font-vt323 text-xs text-retro-text/30 mt-1">En az 10, en fazla 2000 karakter</p>
            </div>

            <div id="contact-error" class="text-retro-accent font-vt323 text-sm hidden"></div>

            <button type="submit" id="contact-submit" class="btn-retro w-full">GÖNDER</button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('contact-form').addEventListener('submit', handleSubmit);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const errorEl = document.getElementById('contact-error');
    const submitBtn = document.getElementById('contact-submit');

    errorEl.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Gönderiliyor...';

    try {
      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const subject = form.subject.value.trim();
      const message = form.message.value.trim();

      // Client-side validasyon
      if (name.length < 2) throw new Error('İsim en az 2 karakter olmalıdır');
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Geçerli bir e-posta adresi giriniz');
      if (subject.length < 2) throw new Error('Konu en az 2 karakter olmalıdır');
      if (message.length < 10) throw new Error('Mesaj en az 10 karakter olmalıdır');

      await Api.post('/contact', { name, email, subject, message });
      submitted = true;
      render();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'GÖNDER';
    }
  }

  render();

  return {
    destroy() {},
  };
}

Router.register('/contact', (container) => {
  return ContactView(container);
});
