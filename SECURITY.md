# Güvenlik Politikası

## Desteklenen Sürümler

| Sürüm | Destek Durumu |
|-------|---------------|
| 1.x   | ✅ Aktif destek |

## Güvenlik Açığı Bildirme

Bir güvenlik açığı keşfettiyseniz, lütfen **public issue açmayın**. Bunun yerine sorumlu bildirim sürecini izleyin:

### Bildirim Kanalları

1. **E-posta**: [bcan@berkecansakalar.com](mailto:bcan@berkecansakalar.com)
2. **GitHub Security Advisory**: [Güvenlik bildirimi oluştur](https://github.com/bcsakalar/katmanisimsehir/security/advisories/new)

### Bildiriminizde Bulunması Gerekenler

- Güvenlik açığının türü (XSS, SQL injection, auth bypass, vs.)
- Etkilenen dosya(lar)ın yolu
- Açığı tetiklemek için gereken adımlar
- Olası etkisi (veri sızıntısı, yetki yükseltme, vs.)
- Varsa önerilen düzeltme

### Yanıt Süreci

| Adım | Süre |
|------|------|
| İlk yanıt | 48 saat içinde |
| Durum güncellemesi | 7 gün içinde |
| Düzeltme yayını | Kritiklik seviyesine bağlı |

## Güvenlik Önlemleri

Bu projede uygulanan güvenlik katmanları:

### Kimlik Doğrulama & Yetkilendirme

- JWT access token (15 dk) + refresh token rotasyonu (7 gün, SHA-256 hash)
- bcrypt ile şifre hashleme (salt rounds: 10+)
- Hesap kilitleme: 5 başarısız giriş → 15 dakika bekleme
- Rol tabanlı erişim kontrolü (RBAC): user, admin
- Admin guard middleware ile yönetici endpoint koruması

### Input Doğrulama & Sanitizasyon

- DOMPurify ile XSS koruması (server-side)
- Parameterized SQL sorguları ($1, $2...) — SQL injection koruması
- JSON body limiti: 100KB
- Dosya yükleme sınırı: 4MB
- Cevap alanı sınırı: max 30 kategori

### Rate Limiting

- Genel: 100 istek/dakika
- Auth endpoint: 5 istek/15 dakika
- Register: 3 istek/saat
- Contact form: 3 istek/saat
- Socket event bazlı rate limiting

### HTTP Güvenlik Header'ları (Helmet)

- Content-Security-Policy (CSP)
- Strict-Transport-Security (HSTS)
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy

### Altyapı Güvenliği

- Docker: Non-root kullanıcı (`iskuser:1001`)
- Docker: Read-only filesystem + tmpfs
- Docker: `no-new-privileges` security option
- Docker: dumb-init ile sinyal yönetimi
- PostgreSQL: Sadece iç ağdan erişim (production)
- Nginx: SSL/TLS termination + rate limiting

### CORS

- Whitelist tabanlı origin doğrulama
- Production'da sadece belirli domain'lere izin

## Güvenlik Testleri

Projede 3 ayrı güvenlik test dosyası mevcuttur:

- **Authorization testleri**: Yetki kontrolü, rol bazlı erişim
- **Socket rate-limit testleri**: WebSocket event flood koruması
- **DoS protection testleri**: Input boyutu sınırlama, kaynak tüketimi koruması

```bash
# Güvenlik testlerini çalıştırma
npm test -- --testPathPattern=security
```

## Bağımlılık Güvenliği

CI/CD pipeline'ında otomatik güvenlik taraması:

```bash
# Manuel güvenlik taraması
npm audit --omit=dev
```

## Versiyonlama Kısıtları

Aşağıdaki paketlerin belirtilen sürümleri aşılmamalıdır (breaking change veya ESM-only):

| Paket | Max Sürüm | Neden |
|-------|-----------|-------|
| uuid | 11.x | v12+ ESM-only |
| express-rate-limit | 7.x | v8 ESM-only |
| jsdom | 26.x | v27+ Node 22 gerektirir |
| express | 4.x | v5 breaking changes |
| tailwindcss | 3.x | v4 farklı mimari |
