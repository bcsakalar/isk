# Dizin Yapısı — Katman İsim Şehir

> Son güncelleme: 2025-03-30

## Tam Ağaç

```
katmanisimsehir/
│
├─ KÖK DOSYALAR
│  ├─ package.json              — Bağımlılıklar ve npm script'leri
│  ├─ Dockerfile                — Multi-stage (base → dev → build → production)
│  ├─ docker-compose.dev.yml    — Development: App:3007, DB:5437
│  ├─ docker-compose.prod.yml   — Production: App:3006, DB:internal
│  ├─ docker-compose.yml        — Ana compose
│  ├─ docker-entrypoint.sh      — Container başlangıç script'i (migrate + seed + start)
│  ├─ tailwind.config.js        — Retro gaming teması (Press Start 2P font, neon renkler)
│  ├─ .env / .env.example       — Ortam değişkenleri
│  ├─ .gitignore                — node_modules, .env, output.css, logs, coverage
│  ├─ .dockerignore             — md dosyaları, compose dosyaları, .git
│  ├─ jest.config.js            — Jest yapılandırması (node, testMatch, testTimeout: 30s)
│  ├─ server.md                 — Sunucu operasyon rehberi
│  ├─ README.md                 — Proje tanıtımı
│  ├─ AGENTS.md                 — AI agent giriş noktası
│  ├─ CLAUDE.md                 — Claude/Copilot talimatları
│  ├─ .cursorrules              — Cursor AI kuralları
│  └─ MEMORY.md                 — Dinamik durum ve TODO takibi
│
├─ knowledge/                   — AI bilgi tabanı (6 dosya)
│  ├─ architecture.md           — Mimari ve veri akışı
│  ├─ directory_structure.md    — Bu dosya
│  ├─ database_and_state.md     — DB şeması ve state management
│  ├─ business_logic.md         — İş kuralları ve oyun mekanikleri
│  ├─ commands_and_scripts.md   — Terminal komutları ve deploy
│  └─ testing_strategy.md       — Test altyapısı ve standartlar
│
├─ nginx/                       — VPS nginx yapılandırması (3 dosya)
│  ├─ nginx.conf                — Ana nginx config
│  ├─ isk.conf                  — Site server block (proxy_pass → 3006)
│  └─ security.conf             — Güvenlik header'ları
│
├─ server/                      — Backend (Node.js + Express)
│  ├─ index.js                  — GİRİŞ NOKTASI: middleware → routes → socket → cron → listen
│  │
│  ├─ config/                   — 3 dosya
│  │  ├─ env.js                 — .env parser + production güvenlik kontrolleri
│  │  ├─ database.js            — pg Pool (max:20) + query() + transaction() helper
│  │  └─ cors.js                — CORS policy (origin + credentials)
│  │
│  ├─ middleware/               — 5 dosya
│  │  ├─ auth.js                — authenticateToken, checkBan, optionalAuth
│  │  ├─ adminGuard.js          — role === 'admin' kontrolü
│  │  ├─ helmet.js              — CSP + HSTS + Permissions-Policy
│  │  ├─ rateLimiter.js         — general(100/min), auth(10/min), register(5/hr), contact(3/hr), api(60/min)
│  │  └─ sanitizer.js           — DOMPurify ile XSS koruması (max depth: 10)
│  │
│  ├─ routes/                   — 8 dosya
│  │  ├─ auth.routes.js         — /api/auth/* (register, login, guest, refresh, logout, me)
│  │  ├─ room.routes.js         — /api/rooms/* (CRUD, join, leave, settings)
│  │  ├─ game.routes.js         — /api/game/* (oyun detayları)
│  │  ├─ user.routes.js         — /api/users/* (profil, ayarlar)
│  │  ├─ admin.routes.js        — /api/admin/* (yönetim paneli)
│  │  ├─ leaderboard.routes.js  — /api/leaderboard/* (sıralama)
│  │  ├─ contact.routes.js      — /api/contact/* (iletişim formu)
│  │  └─ kvkk.routes.js         — /api/kvkk/* (gizlilik, veri silme)
│  │
│  ├─ controllers/              — 8 dosya
│  │  ├─ auth.controller.js
│  │  ├─ room.controller.js
│  │  ├─ game.controller.js
│  │  ├─ user.controller.js
│  │  ├─ admin.controller.js
│  │  ├─ leaderboard.controller.js
│  │  ├─ contact.controller.js
│  │  └─ kvkk.controller.js
│  │
│  ├─ services/                 — 8 dosya
│  │  ├─ auth.service.js        — Register, login, guest login, JWT, refresh token
│  │  ├─ game.service.js        — Oyun başlat, tur yönet, oylama, bitir
│  │  ├─ room.service.js        — Oda oluştur, katıl, ayrıl, sahiplik devret, ayarlar
│  │  ├─ scoring.service.js     — Skor hesapla, oylama finalize
│  │  ├─ answer.service.js      — Cevap doğrulama (harf kontrolü, uniqueness)
│  │  ├─ cleanup.service.js     — Oda/session/chat/guest temizleme
│  │  ├─ contact.service.js     — İletişim formu CRUD
│  │  └─ kvkk.service.js        — Gizlilik onay, veri silme, veri export
│  │
│  ├─ socket/
│  │  ├─ index.js               — Socket.IO server init (maxHttpBufferSize: 1MB)
│  │  ├─ middleware/             — 3 dosya
│  │  │  ├─ socketAuth.js       — JWT doğrulama (handshake.auth.token)
│  │  │  ├─ socketRateLimit.js  — 5 mesaj/saniye, user.id bazlı
│  │  │  └─ socketSanitizer.js  — Socket payload DOMPurify sanitizasyonu
│  │  └─ handlers/              — 5 dosya
│  │     ├─ lobby.handler.js    — lobby:* eventleri (oda listesi, online sayısı)
│  │     ├─ room.handler.js     — room:* eventleri (katıl, ayrıl, hazır, ayarlar)
│  │     ├─ game.handler.js     — game:* eventleri (başlat, cevap, oylama, kanıt)
│  │     ├─ chat.handler.js     — chat:* eventleri (mesaj gönder/al)
│  │     └─ admin.handler.js    — admin:* eventleri (duyuru, kick)
│  │
│  ├─ db/
│  │  ├─ migrate.js             — Migration runner (sıralı SQL dosyaları)
│  │  ├─ seed.js                — Seed runner (kategoriler, başarımlar, admin)
│  │  ├─ migrations/            — 11 dosya
│  │  │  ├─ 001_initial_schema.sql        — Ana şema: 19 tablo + trigger + index
│  │  │  ├─ 002_answer_challenges.sql     — İtiraz tablosu
│  │  │  ├─ 003_schema_fixes.sql          — categories.description, achievements condition→JSONB
│  │  │  ├─ 004_remove_email_required_add_guest.sql — email nullable, misafir sistemi
│  │  │  ├─ 005_game_v2_overhaul.sql      — Oylama sistemi, answer_votes, answer_images
│  │  │  ├─ 006_fix_role_check_guest.sql  — Role CHECK'e 'guest' ekleme
│  │  │  ├─ 007_voting_timer_constraint.sql — voting_timer: 0 veya 10-300
│  │  │  ├─ 008_security_kvkk.sql         — Account lockout, privacy_consents, user_deletions
│  │  │  ├─ 009_contact_messages.sql      — İletişim formu tablosu
│  │  │  ├─ 010_drop_joker_tables.sql     — Joker tabloları kaldırıldı
│  │  │  └─ 011_cleanup_custom_categories.sql — Geçersiz kategoriler temizlendi
│  │  ├─ seeds/                 — 2 dosya
│  │  │  ├─ categories.seed.sql — 20 kategori + 10 başarım
│  │  │  └─ admin.seed.sql      — Admin kullanıcı (bcrypt)
│  │  └─ queries/               — 6 dosya
│  │     ├─ users.queries.js    — Kullanıcı CRUD, guest, ban, lockout
│  │     ├─ rooms.queries.js    — Oda CRUD + oyuncu yönetimi + ayarlar
│  │     ├─ games.queries.js    — ~30 oyun/tur/cevap/oylama/kanıt sorgusu
│  │     ├─ admin.queries.js    — Admin log, duyuru, rapor, iletişim
│  │     ├─ contact.queries.js  — İletişim formu CRUD
│  │     └─ kvkk.queries.js     — Gizlilik onay, veri silme, veri export
│  │
│  ├─ jobs/                     — 6 dosya (node-cron zamanlanmış görevler)
│  │  ├─ roomCleanup.job.js     — Her 5 dk: 30 dk inaktif odaları terk et
│  │  ├─ sessionCleanup.job.js  — Her saat: süresi dolan session'ları sil
│  │  ├─ chatPurge.job.js       — Her gün 03:00: 7 günden eski mesajları sil
│  │  ├─ leaderboardReset.job.js — Her Pazar 00:00: haftalık sıralama sıfırla
│  │  ├─ accountDeletion.job.js — Her saat: KVKK silme kuyruğunu işle
│  │  └─ guestCleanup.job.js    — Her 30 dk: süresi dolan misafir hesapları temizle
│  │
│  └─ utils/                    — 4 dosya
│     ├─ errors.js              — AppError → BadRequest, Unauthorized, Forbidden, NotFound, Conflict, RateLimit
│     ├─ logger.js              — winston (console + file transport)
│     ├─ letterPool.js          — 29 Türkçe harf, kolay/zor ayrımı, rastgele seçim
│     └─ crypto.js              — Room code + token üretimi
│
├─ client/                      — Frontend (Vanilla JS SPA)
│  ├─ index.html                — Tek HTML: CDN'ler (Tailwind, Socket.IO, Font), tüm JS script'leri
│  ├─ manifest.json             — PWA manifest
│  ├─ robots.txt                — Arama motoru yönergeleri
│  ├─ sitemap.xml               — Site haritası
│  ├─ css/
│  │  ├─ tailwind.css           — Tailwind input
│  │  └─ output.css             — Tailwind CLI ile oluşturulan çıktı (.gitignore'da)
│  └─ js/
│     ├─ app.js                 — Init: auth guard, socket bağlantı, router resolve
│     ├─ socket.js              — Socket.IO client wrapper
│     ├─ views/                 — 12 sayfa render fonksiyonu
│     │  ├─ auth.js             — Giriş/kayıt/misafir formları
│     │  ├─ lobby.js            — Ana lobi, oda listesi
│     │  ├─ room.js             — Oda bekleme odası
│     │  ├─ game.js             — Oyun ekranı
│     │  ├─ voting.js           — Oylama/kanıt ekranı
│     │  ├─ scoreboard.js       — Tur sonu skor tablosu
│     │  ├─ leaderboard.js      — Genel sıralama
│     │  ├─ profile.js          — Kullanıcı profili
│     │  ├─ contact.js          — İletişim formu
│     │  ├─ privacy.js          — Gizlilik/KVKK sayfası
│     │  ├─ invite.js           — Davet linki sayfası
│     │  └─ error.js            — Hata sayfası (404/500)
│     ├─ components/            — 7 yeniden kullanılabilir UI bileşeni
│     │  ├─ chat.js             — Sohbet paneli
│     │  ├─ modal.js            — Modal dialog
│     │  ├─ notification.js     — Bildirim banner
│     │  ├─ timer.js            — Geri sayım zamanlayıcı
│     │  ├─ toast.js            — Toast bildirimleri
│     │  ├─ categoryEditor.js   — Kategori seçim/düzenleme
│     │  └─ letterSelector.js   — Harf havuzu seçici
│     └─ utils/                 — 4 yardımcı modül
│        ├─ router.js           — History API SPA router (pushState)
│        ├─ store.js            — Reactive state (get/set/on/update)
│        ├─ api.js              — fetch wrapper (JWT auto-refresh)
│        └─ validators.js       — Client-side doğrulama
│
├─ admin/                       — Admin Panel (ayrı SPA)
│  ├─ index.html                — Admin HTML
│  └─ js/
│     └─ admin-app.js           — Dashboard (kullanıcı/oda/rapor/iletişim yönetimi)
│
├─ tests/                       — Test dosyaları (Jest 30 + Supertest 7)
│  ├─ setup.js                  — Global test setup (NODE_ENV, JWT secret, logger mock)
│  ├─ helpers/                  — 4 yardımcı dosya
│  │  ├─ factories.js           — 7 mock factory (user, guest, room, player, round, answer, category)
│  │  ├─ testApp.js             — Supertest için Express app oluşturucu
│  │  ├─ socketTestServer.js    — Socket.IO test server helper
│  │  └─ socketTestClient.js    — Socket.IO test client helper
│  ├─ unit/                     — 19 unit test dosyası
│  │  ├─ config/
│  │  │  └─ env.test.js         — Ortam değişkeni doğrulama
│  │  ├─ services/              — 9 servis unit testi
│  │  │  ├─ answer.service.test.js
│  │  │  ├─ auth.service.test.js
│  │  │  ├─ cleanup.service.test.js
│  │  │  ├─ contact.service.test.js
│  │  │  ├─ game.service.test.js
│  │  │  ├─ kvkk.service.test.js
│  │  │  ├─ room.service.test.js
│  │  │  ├─ room-settings.service.test.js
│  │  │  └─ scoring.service.test.js
│  │  ├─ middleware/             — 5 middleware unit testi
│  │  │  ├─ auth.test.js
│  │  │  ├─ sanitizer.test.js
│  │  │  ├─ adminGuard.test.js
│  │  │  ├─ rateLimiter.test.js
│  │  │  └─ socketSanitizer.test.js
│  │  ├─ queries/               — 1 query unit testi
│  │  │  └─ games.queries.test.js
│  │  └─ utils/                 — 3 util unit testi
│  │     ├─ errors.test.js
│  │     ├─ letterPool.test.js
│  │     └─ crypto.test.js
│  ├─ integration/              — 6 HTTP route integration testi
│  │  ├─ auth.routes.test.js
│  │  ├─ room.routes.test.js
│  │  ├─ game.routes.test.js
│  │  ├─ admin.routes.test.js
│  │  ├─ contact.routes.test.js
│  │  └─ kvkk.routes.test.js
│  ├─ socket/                   — 2 socket middleware testi
│  │  ├─ socketAuth.test.js
│  │  └─ socketRateLimit.test.js
│  ├─ security/                 — 3 güvenlik testi
│  │  ├─ xss.test.js
│  │  ├─ auth-security.test.js
│  │  └─ input-validation.test.js
│  └─ e2e/                      — 6 uçtan uca test
│     ├─ game-lifecycle.test.js — Tam oyun döngüsü
│     ├─ room-lifecycle.test.js — Oda yaşam döngüsü
│     ├─ voting-evidence.test.js — Oylama + kanıt sistemi
│     ├─ chat-lobby.test.js     — Chat + lobi etkileşimleri
│     ├─ edge-cases.test.js     — Sınır durumları
│     └─ performance.test.js    — Performans testleri
│
└─ logs/                        — Winston log dosyaları (.gitignore'da)
```

## Dosya Sayıları

| Klasör | Dosya Sayısı | Ana Uzantı |
|--------|-------------|------------|
| server/config | 3 | .js |
| server/middleware | 5 | .js |
| server/routes | 8 | .js |
| server/controllers | 8 | .js |
| server/services | 8 | .js |
| server/socket/handlers | 5 | .js |
| server/socket/middleware | 3 | .js |
| server/db/queries | 6 | .js |
| server/db/migrations | 11 | .sql |
| server/db/seeds | 2 | .sql |
| server/jobs | 6 | .js |
| server/utils | 4 | .js |
| client/js/views | 12 | .js |
| client/js/components | 7 | .js |
| client/js/utils | 4 | .js |
| admin | 2 | .html + .js |
| tests (toplam) | 36 test + 5 helper | .test.js + .js |
| nginx | 3 | .conf |
| kök | 12+ | çeşitli |
