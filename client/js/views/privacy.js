// Privacy View — Gizlilik Politikası
function PrivacyView(container) {
  function render() {
    container.innerHTML = `
      <div class="max-w-3xl mx-auto space-y-6">
        <div class="text-center">
          <h2 class="font-pixel text-retro-accent text-sm">GİZLİLİK POLİTİKASI</h2>
          <p class="font-vt323 text-retro-text/50 mt-2">Kişisel Verilerin Korunması</p>
        </div>

        <div class="card-retro prose-retro">
          <h3 class="font-pixel text-xs text-retro-gold mb-4">TOPLANAN VERİLER</h3>
          <div class="font-vt323 text-sm text-retro-text/70 mb-6 space-y-2">
            <p>• Kullanıcı adı ve görünen isim</p>
            <p>• E-posta adresi (opsiyonel)</p>
            <p>• Oyun istatistikleri ve skorlar</p>
            <p>• Oyun içi sohbet mesajları</p>
          </div>

          <h3 class="font-pixel text-xs text-retro-gold mb-4">VERİLERİN KULLANIMI</h3>
          <div class="font-vt323 text-sm text-retro-text/70 mb-6 space-y-2">
            <p>Verileriniz yalnızca oyun hizmetinin sunulması ve hesap yönetimi için kullanılır. Üçüncü taraflarla paylaşılmaz.</p>
          </div>

          <h3 class="font-pixel text-xs text-retro-gold mb-4">VERİLERİN SAKLANMASI</h3>
          <div class="font-vt323 text-sm text-retro-text/70 mb-6 space-y-2">
            <p>• Hesap verileri: Hesap silinene kadar</p>
            <p>• Sohbet mesajları: 7 gün</p>
            <p>• Misafir hesapları: 24 saat sonra otomatik silinir</p>
          </div>

          <h3 class="font-pixel text-xs text-retro-gold mb-4">HAKLARINIZ</h3>
          <div class="font-vt323 text-sm text-retro-text/70 mb-6 space-y-2">
            <p>Profil sayfanızdaki "Veri Yönetimi" bölümünden:</p>
            <p>• <strong>Verilerimi İndir:</strong> Tüm verilerinizi JSON formatında indirebilirsiniz</p>
            <p>• <strong>Hesabımı Sil:</strong> 30 günlük bekleme süresi sonunda tüm verileriniz kalıcı olarak silinir</p>
          </div>
        </div>

        <div class="text-center">
          <a href="/" data-link class="btn-retro-outline text-xs">ANA SAYFAYA DÖN</a>
        </div>
      </div>
    `;
  }

  render();
  return { destroy() {} };
}

Router.register('/privacy', (container) => {
  return PrivacyView(container);
});
