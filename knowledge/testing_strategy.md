# Test Stratejisi — Katman İsim Şehir

> Son güncelleme: 2025-03-30

## ✅ Mevcut Durum

**Test altyapısı AKTIF.** Jest + Supertest kurulu, 36 test dosyası, 442 test, %100 geçiyor.

## Test Stack

| Araç | Versiyon | Amaç |
|------|----------|------|
| Jest | ^30.3.0 | Test runner + assertion + mocking |
| Supertest | ^7.2.2 | HTTP endpoint integration testleri |
| socket.io-client | ^4.8.3 | Socket.IO e2e testleri (devDependency) |

### Komutlar
```bash
npm test                # Tüm testleri çalıştır (--runInBand --forceExit)
npm run test:watch      # Watch modunda testleri çalıştır
npm run test:coverage   # Coverage raporu ile testleri çalıştır
```

### jest.config.js
```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/db/migrations/**',
    '!server/db/seeds/**',
    '!server/index.js',
    '!server/config/env.js',
  ],
  setupFiles: ['./tests/setup.js'],
  testTimeout: 30000,
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
};
```

## Dosya Yapısı

```
tests/
├─ setup.js                               — Global test setup (NODE_ENV, JWT secret, logger mock)
├─ helpers/
│  ├─ factories.js                        — 7 mock factory (user, guest, room, player, round, answer, category)
│  ├─ testApp.js                          — Supertest için Express app oluşturucu
│  ├─ socketTestServer.js                 — Socket.IO test server helper (e2e testler için)
│  └─ socketTestClient.js                 — Socket.IO test client helper (e2e testler için)
├─ unit/
│  ├─ config/
│  │  └─ env.test.js                      — Ortam değişkeni doğrulama testleri
│  ├─ services/
│  │  ├─ answer.service.test.js           — Cevap doğrulama + karşılaştırma
│  │  ├─ auth.service.test.js             — Register, login, guest login, logout
│  │  ├─ room.service.test.js             — CRUD, join, leave, ready
│  │  ├─ room-settings.service.test.js    — Oda ayarları güncelleme
│  │  ├─ game.service.test.js             — Oyun başlat, tur, cevap, oylama
│  │  ├─ scoring.service.test.js          — Puanlama + oylama finalize
│  │  ├─ cleanup.service.test.js          — Temizleme servisleri
│  │  ├─ contact.service.test.js          — İletişim formu CRUD
│  │  └─ kvkk.service.test.js             — Gizlilik onay, veri silme
│  ├─ middleware/
│  │  ├─ auth.test.js                     — authenticateToken, checkBan, optionalAuth
│  │  ├─ sanitizer.test.js                — sanitizeInput, sanitizeString
│  │  ├─ adminGuard.test.js               — adminGuard, moderatorGuard
│  │  ├─ rateLimiter.test.js              — 5 limiter config + Türkçe mesajlar
│  │  └─ socketSanitizer.test.js          — Socket payload sanitizasyonu
│  ├─ queries/
│  │  └─ games.queries.test.js            — Oyun sorguları birim testi
│  └─ utils/
│     ├─ errors.test.js                   — 7 error class
│     ├─ letterPool.test.js               — Türkçe harf havuzu
│     └─ crypto.test.js                   — Room code + token üretimi
├─ integration/
│  ├─ auth.routes.test.js                 — /api/auth/* HTTP testleri
│  ├─ room.routes.test.js                 — /api/rooms/* HTTP testleri
│  ├─ game.routes.test.js                 — /api/game/* HTTP testleri
│  ├─ admin.routes.test.js                — /api/admin/* HTTP testleri
│  ├─ contact.routes.test.js              — /api/contact/* HTTP testleri
│  └─ kvkk.routes.test.js                — /api/kvkk/* HTTP testleri
├─ socket/
│  ├─ socketAuth.test.js                  — JWT socket auth middleware
│  └─ socketRateLimit.test.js             — Mesaj rate limiting
├─ security/
│  ├─ xss.test.js                         — XSS payload testleri
│  ├─ auth-security.test.js               — JWT güvenlik testleri
│  └─ input-validation.test.js            — Input validation + edge cases
└─ e2e/
   ├─ game-lifecycle.test.js              — Tam oyun döngüsü (oda→oyun→oylama→skor→bitiş)
   ├─ room-lifecycle.test.js              — Oda yaşam döngüsü (oluştur→katıl→ayar→ayrıl)
   ├─ voting-evidence.test.js             — Oylama + kanıt resmi sistemi
   ├─ chat-lobby.test.js                  — Chat + lobi etkileşimleri
   ├─ edge-cases.test.js                  — Sınır durumları (disconnect, timeout, vb.)
   └─ performance.test.js                 — Yük ve performans testleri
```

**Toplam: 36 test dosyası, 442 test**

### Test Kategorileri Özet

| Kategori | Dosya Sayısı | Açıklama |
|----------|-------------|----------|
| unit/config | 1 | Ortam değişkeni doğrulama |
| unit/services | 9 | Servis katmanı birim testleri |
| unit/middleware | 5 | Middleware birim testleri |
| unit/queries | 1 | Query katmanı birim testleri |
| unit/utils | 3 | Yardımcı modül testleri |
| integration | 6 | HTTP route integration testleri |
| socket | 2 | Socket middleware testleri |
| security | 3 | Güvenlik testleri (XSS, JWT, input) |
| e2e | 6 | Uçtan uca senaryo testleri |

## Test Yazım Standartları

### Şablon — Service Unit Test

```javascript
// tests/unit/services/scoring.service.test.js
const scoringService = require('../../../server/services/scoring.service');
const gamesQueries = require('../../../server/db/queries/games.queries');

// Mock dependencies
jest.mock('../../../server/db/queries/games.queries');

describe('scoringService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scoreRound', () => {
    it('boş cevaba 0 puan vermeli', async () => {
      // Arrange
      const answers = [{ answer: '', category_id: 1, player_id: 1 }];
      gamesQueries.getAnswersForRound.mockResolvedValue(answers);

      // Act
      const result = await scoringService.scoreRound(roundId, 'A', false);

      // Assert
      expect(result[0].base_score).toBe(0);
    });

    it('benzersiz doğru cevaba 10 puan vermeli', async () => {
      // Arrange, Act, Assert...
    });
  });
});
```

### Şablon — HTTP Integration Test

```javascript
// tests/integration/auth.routes.test.js
const request = require('supertest');
const express = require('express');
// ... app setup veya import

describe('POST /api/auth/register', () => {
  it('geçerli bilgilerle kullanıcı oluşturmalı', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        email: 'test@test.com',
        password: 'Test1234!'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('3 karakterden kısa kullanıcı adı reddetmeli', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'ab', email: 'test@test.com', password: 'Test1234!' });

    expect(res.status).toBe(400);
  });
});
```

### Şablon — E2E Socket Test

```javascript
// tests/e2e/game-lifecycle.test.js
// socketTestServer + socketTestClient helper'ları kullanılır
// Tam oyun döngüsü test edilir: oda oluştur → katıl → başlat → cevapla → oyla → skor → bitir

describe('Game Lifecycle E2E', () => {
  let server, clientSocket;

  beforeAll(async () => {
    // socketTestServer.js ile server başlat
  });

  afterAll(async () => {
    // cleanup
  });

  it('tam oyun döngüsü tamamlanmalı', async () => {
    // Oda oluştur, oyuncu katıl, oyun başlat...
  });
});
```

## Test Helper'lar

### factories.js — 7 Mock Factory

| Fonksiyon | Açıklama |
|-----------|----------|
| `getMockUser(overrides)` | Kayıtlı oyuncu (player role) |
| `getMockGuestUser(overrides)` | Misafir kullanıcı (guest role, expires_at) |
| `getMockRoom(overrides)` | Oda (waiting status, voting ayarları dahil) |
| `getMockRoomPlayer(overrides)` | Oda-oyuncu kaydı |
| `getMockRound(overrides)` | Tur (harf, oylama timestamps) |
| `getMockAnswer(overrides)` | Cevap (vote_score, is_duplicate dahil) |
| `getMockCategory(overrides)` | Kategori |

### testApp.js
Express app oluşturucu — route'ları mock service'ler ile yükler, Supertest ile kullanılır.

### socketTestServer.js / socketTestClient.js
E2E testler için Socket.IO server ve client wrapper'ları. Olay dinleme, bekleme, bağlantı yönetimi.

## Katı Test Kuralları

1. **Yeni kod = yeni test**: Her yeni fonksiyon, endpoint, handler veya middleware kendi testi ile gelmelidir
2. **Mevcut testleri bozma**: Değişikliklerden sonra `npm test` geçmeli
3. **AAA Formatı**: Her test Arrange → Act → Assert yapısında olmalı
4. **Açıklayıcı isimler**: `it('boş cevaba 0 puan vermeli')` — Türkçe açıklama tercih edilir
5. **Mock sınırları**: Unit testlerde dış bağımlılıkları mock'la, integration testlerde gerçek kullan
6. **Minimum kapsam hedefi**: Services %80, Middleware %90, Utils %100
7. **Edge case zorunluluğu**: Her test dosyasında en az 1 hata senaryosu (invalid input, unauthorized, vb.)
8. **testTimeout**: 30000ms (jest.config.js) — e2e testler için yeterli süre
