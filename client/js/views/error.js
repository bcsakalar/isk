// Error View — 404 ve Genel Hata Sayfası
function ErrorView(container, { params, query }) {
  const errorCode = query?.get('code') || '404';
  const errorMessage = query?.get('message') || null;

  const errorMap = {
    '404': {
      icon: '🔍',
      title: 'SAYFA BULUNAMADI',
      description: 'Aradığınız sayfa mevcut değil veya kaldırılmış olabilir.',
    },
    '429': {
      icon: '⏳',
      title: 'ÇOK FAZLA İSTEK',
      description: 'Çok fazla istek gönderdiniz, lütfen biraz bekleyip tekrar deneyin.',
    },
    '403': {
      icon: '🚫',
      title: 'ERİŞİM ENGELLENDI',
      description: 'Bu sayfaya erişim yetkiniz bulunmuyor.',
    },
    '500': {
      icon: '💥',
      title: 'SUNUCU HATASI',
      description: 'Bir şeyler ters gitti. Lütfen daha sonra tekrar deneyin.',
    },
  };

  const errorInfo = errorMap[errorCode] || errorMap['404'];

  function render() {
    container.innerHTML = `
      <div class="max-w-md mx-auto mt-8 sm:mt-16 text-center space-y-4 sm:space-y-6">
        <div class="text-4xl sm:text-6xl mb-4">${errorInfo.icon}</div>
        <div class="card-retro p-8 space-y-4">
          <h1 class="font-pixel text-retro-accent text-lg">${errorCode}</h1>
          <h2 class="font-pixel text-retro-gold text-sm">${errorInfo.title}</h2>
          <p class="font-vt323 text-retro-text/60 text-lg">
            ${errorMessage ? escapeHtml(errorMessage) : errorInfo.description}
          </p>
        </div>
        <button class="btn-retro" id="btn-error-home">ANA SAYFAYA DÖN</button>
      </div>
    `;

    container.querySelector('#btn-error-home')?.addEventListener('click', () => {
      Router.navigate('/');
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  render();
  return { destroy() {} };
}

Router.register('/error', ErrorView);
Router.register('/404', ErrorView);
