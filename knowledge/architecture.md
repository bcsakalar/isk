# Mimari — Katman İsim Şehir

> Son güncelleme: 2026-03-30

## Genel Bakış

Monolitik Node.js uygulaması, vanilla JS SPA frontend ve PostgreSQL veritabanı. HTTP ve WebSocket (Socket.IO) üzerinden iletişim. Oylama tabanlı skorlama, misafir giriş, KVKK uyumu ve iletişim formu içerir.

## Katman Diyagramı

```
┌──────────────────────────────────────────────────┐
│  CLIENT (Vanilla JS SPA)                         │
│  ├─ History API Router (/auth, /lobby, /room/..) │
│  ├─ Store (reactive state management)            │
│  ├─ Api (fetch wrapper + JWT refresh)            │
│  └─ SocketClient (socket.io-client)              │
└───────────┬──────────────────┬───────────────────┘
            │ HTTP REST        │ WebSocket
            ▼                  ▼
┌──────────────────────────────────────────────────┐
│  EXPRESS SERVER (server/index.js)                 │
│                                                  │
│  ┌─ MIDDLEWARE PIPELINE ─────────────────────┐   │
│  │ helmet → cors → json(100kb) → rate limit  │   │
│  │ → sanitizer → [auth] → route handler      │   │
│  └───────────────────────────────────────────┘   │
│                                                  │
│  ┌─ HTTP KATMANI ───────┐  ┌─ SOCKET KATMANI ─┐ │
│  │ 8 Route grubu         │  │ 5 Handler grubu   │ │
│  │  └→ 8 Controller      │  │  ├─ lobby         │ │
│  │      └→ 8 Service     │  │  ├─ room          │ │
│  │          └→ 6 Query   │  │  ├─ game          │ │
│  │              └→ DB    │  │  ├─ chat          │ │
│  └───────────────────────┘  │  └─ admin         │ │
│                              │ Middleware:        │ │
│                              │  socketAuth        │ │
│                              │  socketRateLimit   │ │
│                              │  socketSanitizer   │ │
│                              └───────────────────┘ │
│                                                  │
│  ┌─ BACKGROUND ─────────────────────────────┐   │
│  │ Cron Jobs: roomCleanup, sessionCleanup,   │   │
│  │   chatPurge, leaderboardReset,            │   │
│  │   accountDeletion, guestCleanup           │   │
│  └───────────────────────────────────────────┘   │
└───────────┬──────────────────────────────────────┘
            │ pg driver (raw SQL)
            ▼
┌──────────────────────────────────────────────────┐
│  PostgreSQL 16 — 23+ tablo, 11 migration         │
│  Connection pool: max 20, idle 30s, timeout 5s   │
└──────────────────────────────────────────────────┘
```

## Veri Akışı — HTTP İstek

```
1. Client → fetch('/api/rooms', { headers: { Authorization: Bearer <JWT> } })
2. Middleware pipeline: helmet → cors → JSON parse → generalLimiter → sanitizeInput
3. Route matching: app.use('/api/rooms', roomRoutes)
4. Auth check: authenticateToken middleware (JWT verify)
5. Controller: roomController.list(req, res)
6. Service: roomService.listActive()
7. Query: roomsQueries.listActive(50) → SELECT * FROM rooms...
8. Response: res.json({ success: true, data: rooms })
```

## Veri Akışı — WebSocket Event

```
1. Client → socket.emit('game:submit_answers', { answers: {...} })
2. Socket middleware: socketAuth (JWT verify) → socketSanitizer → socketRateLimit (user.id bazlı)
3. Handler: gameHandler(io, socket) → socket.on('game:submit_answers')
4. Input validation (type check + integer check)
5. Service: gameService.submitAnswers(roomId, userId, answers)
6. Query: INSERT INTO player_answers ...
7. Broadcast: socket.to(roomKey).emit('game:player_submitted', {...})
```

## Frontend Mimari

```
client/
├─ index.html          → Self-hosted Tailwind, Socket.IO, Google Fonts. SEO meta tags, OG, JSON-LD
├─ manifest.json       → PWA manifest
├─ robots.txt          → Arama motoru yönergeleri
├─ sitemap.xml         → Site haritası
├─ css/
│  ├─ tailwind.css     → Tailwind input dosyası
│  └─ output.css       → Build edilmiş CSS (gitignore'da)
├─ js/
│  ├─ app.js           → Uygulama başlatıcı (auth guard, socket bağlantı, router init)
│  ├─ socket.js        → Socket.IO client wrapper (reconnect + auto-rejoin)
│  ├─ views/           → Sayfa render fonksiyonları (12 SPA view)
│  │  ├─ auth.js       → Login/Register/Misafir giriş formu
│  │  ├─ lobby.js      → Oda listesi, oda oluşturma
│  │  ├─ room.js       → Oda bekleme, hazır ol, kategori/harf seçimi
│  │  ├─ game.js       → Aktif oyun (cevap gir, zamanlayıcı)
│  │  ├─ voting.js     → Oylama fazı (oy ver, kanıt resmi)
│  │  ├─ scoreboard.js → Tur sonu sonuçlar, puanlama detayı
│  │  ├─ leaderboard.js→ Sıralama tablosu (haftalık/aylık)
│  │  ├─ profile.js    → Profil düzenleme, veri yönetimi
│  │  ├─ contact.js    → İletişim formu
│  │  ├─ privacy.js    → KVKK gizlilik politikası
│  │  ├─ invite.js     → Oda davet linki
│  │  └─ error.js      → Hata sayfası (404/500)
│  ├─ components/      → Tekrar kullanılan UI parçaları (7 dosya)
│  │  ├─ categoryEditor.js → Kategori ekleme/çıkarma
│  │  ├─ letterSelector.js → Aktif harf seçimi
│  │  ├─ chat.js       → Oda/lobi sohbet, emoji tepkileri
│  │  ├─ modal.js      → Genel modal dialog
│  │  ├─ notification.js → Bildirim bileşeni
│  │  ├─ timer.js      → Geri sayım (tur + oylama)
│  │  └─ toast.js      → Popup bildirimler
│  └─ utils/
│     ├─ router.js     → History API SPA router + SEO meta tags
│     ├─ store.js      → Reactive state (get/set/on/update ile subscription)
│     ├─ api.js        → fetch wrapper (auto JWT refresh + retry)
│     └─ validators.js → Client-side input doğrulama
```

## State Management

| Katman | Mekanizma | Detay |
|--------|-----------|-------|
| Client | `Store` (in-memory) | Reactive Map + listeners. `Store.get('user')`, `Store.set('gameState', 'playing')`. localStorage'da token ve user persist edilir |
| Server | Yok (stateless) | Her istek JWT ile doğrulanır, state DB'de tutulur |
| Socket | `socket.user` + `socket.currentRoom` | socketAuth middleware user bilgisini ekler, handler'lar currentRoom takip eder |
| DB | PostgreSQL | Tek kaynak (single source of truth) |

## Deployment Mimarisi

```
Internet → nginx (80/443, SSL termination)
             → proxy_pass → Node.js container (3006 prod / 3007 dev)
                              → PostgreSQL container (internal network)
```

Docker Compose projeler `-p isk` prefix ile çalışır. Dev ve prod ayrı compose dosyaları kullanır.

## Modül Sınırları

| Modül | İçe Aktarabilir | İçe Aktaramaz |
|-------|-----------------|---------------|
| routes | controllers, middleware | services, queries, db |
| controllers | services | queries, db doğrudan |
| services | queries, config, utils | routes, controllers, middleware |
| queries | config/database | services, middleware |
| socket handlers | services, queries | routes, controllers |
| middleware | config, utils | services, controllers |
| jobs | services | routes, controllers |
| client/views | client/utils, client/components | server/* |
| client/utils | — (kendi aralarında) | server/* |

## Test Mimarisi

```
tests/
├─ setup.js           — Global test setup (NODE_ENV, JWT secret, logger mock)
├─ helpers/
│  ├─ factories.js           — Mock factory fonksiyonları
│  ├─ testApp.js             — Supertest için Express app oluşturucu
│  ├─ socketTestServer.js    — E2E socket test sunucusu
│  └─ socketTestClient.js    — E2E socket test istemcisi
├─ unit/
│  ├─ config/         — env.test.js
│  ├─ services/       — 9 servis testi (auth, room, game, scoring, answer, cleanup, contact, kvkk, room-settings)
│  ├─ middleware/      — 5 middleware testi (auth, sanitizer, adminGuard, rateLimiter, socketSanitizer)
│  ├─ queries/        — games.queries.test.js
│  └─ utils/          — 3 util testi (errors, letterPool, crypto)
├─ integration/       — 6 HTTP route testi (auth, room, game, admin, contact, kvkk)
├─ e2e/               — 6 E2E socket testi (chat-lobby, room-lifecycle, game-lifecycle, voting-evidence, edge-cases, performance)
├─ socket/            — 2 socket middleware testi (socketAuth, socketRateLimit)
└─ security/          — 3 güvenlik testi (xss, auth-security, input-validation)
```

- **Unit testler**: Dış bağımlılıklar `jest.mock()` ile mock'lanır. Veritabanı bağlantısı gerekmez.
- **Integration testler**: `testApp.js` helper'ı Express app oluşturur, Supertest ile HTTP istekleri yapılır. Service katmanı mock'lanır.
- **E2E testler**: Gerçek Socket.IO sunucusu kurulur. Çok oyunculu senaryolar, stres testleri, disconnect/reconnect testleri.
- **Toplam**: 36 dosya, 442 test. Komut: `npm test`
