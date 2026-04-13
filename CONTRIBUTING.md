# Katkıda Bulunma Rehberi

Katman İsim Şehir projesine katkıda bulunmak istediğiniz için teşekkürler! Bu rehber, katkı sürecini anlatmaktadır.

## İçindekiler

- [Davranış Kuralları](#davranış-kuralları)
- [Nasıl Katkıda Bulunabilirim?](#nasıl-katkıda-bulunabilirim)
- [Geliştirme Ortamı](#geliştirme-ortamı)
- [Kodlama Standartları](#kodlama-standartları)
- [Commit Mesajları](#commit-mesajları)
- [Pull Request Süreci](#pull-request-süreci)
- [Test Yazma](#test-yazma)

---

## Davranış Kuralları

Bu proje [Davranış Kurallarımıza](CODE_OF_CONDUCT.md) tabidir. Katılarak bu kurallara uymayı kabul etmiş olursunuz.

## Nasıl Katkıda Bulunabilirim?

### Bug Raporlama

- [GitHub Issues](https://github.com/bcsakalar/katmanisimsehir/issues) üzerinden bir bug bildirin.
- `bug_report` şablonunu kullanın.
- Hatanın tekrar edilebilir adımlarını, beklenen ve gerçekleşen davranışı açıkça yazın.

### Yeni Özellik Önerisi

- [GitHub Issues](https://github.com/bcsakalar/katmanisimsehir/issues) üzerinden bir özellik isteği açın.
- `feature_request` şablonunu kullanın.
- Özelliğin neden gerekli olduğunu ve olası çözümü açıklayın.

### Kod Katkısı

1. Repo'yu fork edin
2. Feature branch oluşturun (`git checkout -b feature/ozellik-adi`)
3. Değişikliklerinizi yapın
4. Testleri yazın ve mevcut testlerin geçtiğini doğrulayın
5. Commit edin (aşağıdaki [commit kurallarına](#commit-mesajları) uyun)
6. Push edin (`git push origin feature/ozellik-adi`)
7. Pull Request açın

---

## Geliştirme Ortamı

### Gereksinimler

- [Docker](https://www.docker.com/get-started) & Docker Compose v2+
- [Node.js 20](https://nodejs.org/) (Docker dışı geliştirme için)
- Git

### Kurulum

```bash
# 1. Fork edip klonlayın
git clone https://github.com/bcsakalar/katmanisimsehir.git
cd katmanisimsehir

# 2. Environment dosyasını oluşturun
cp .env.example .env

# 3. Docker ile başlatın
npm run docker:dev

# 4. Migration ve seed (ilk seferde)
docker compose -p isk -f docker-compose.dev.yml exec app node server/db/migrate.js
docker compose -p isk -f docker-compose.dev.yml exec app node server/db/seed.js

# 5. Tarayıcıda açın
# http://localhost:3007
```

### Testleri Çalıştırma

```bash
# Tüm testler
npm test

# Watch modunda
npm run test:watch

# Coverage raporu ile
npm run test:coverage
```

---

## Kodlama Standartları

### Dil ve Modül Sistemi

- **JavaScript** (CommonJS — `require`/`module.exports`). TypeScript **kullanılmıyor**.
- Node.js 20 hedefleniyor.

### İsimlendirme

| Kategori | Format | Örnek |
|----------|--------|-------|
| Dosyalar | `feature.layer.js` | `auth.service.js`, `users.queries.js` |
| Değişkenler/fonksiyonlar | `camelCase` | `getInactiveRooms` |
| DB tabloları/sütunları | `snake_case` | `room_players`, `is_banned` |
| Socket event'leri | `namespace:action` | `game:start`, `room:join` |
| Route'lar | `/api/{resource}` | `/api/auth/login` |
| Error class'ları | `PascalCase` + `Error` | `BadRequestError` |

### Stil Kuralları

- **Tek tırnak** (`'string'`)
- **2 space** indent
- Arrow function tercih edilir
- `async/await` tercih edilir (`.then()` kullanılmaz)
- Template literals (`${var}`) tercih edilir
- Destructuring aktif kullanılır

### Mimari Kuralları

- Route → Controller → Service → Query katman sırası
- İş mantığı **service** katmanında yaşar
- SQL sorguları `server/db/queries/` altında, parameterized (`$1`, `$2`)
- Tüm input'lar DOMPurify ile sanitize edilir (server-side)
- Hatalar `AppError` hiyerarşisinden fırlatılır
- Loglama: Winston (`logger.info`, `logger.warn`, `logger.error`)

### UI Dili

- Kullanıcıya dönen tüm mesajlar **Türkçe** yazılır
- Log mesajları İngilizce olabilir

---

## Commit Mesajları

[Conventional Commits](https://www.conventionalcommits.org/) standardını kullanıyoruz:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Tipler

| Tip | Açıklama |
|-----|----------|
| `feat` | Yeni özellik |
| `fix` | Bug düzeltmesi |
| `docs` | Dokümantasyon değişikliği |
| `style` | Kod formatı (mantık değişmez) |
| `refactor` | Kod yeniden yapılandırma |
| `test` | Test ekleme/düzeltme |
| `chore` | Build, CI, tooling değişiklikleri |
| `perf` | Performans iyileştirmesi |
| `security` | Güvenlik düzeltmesi |

### Örnekler

```
feat(game): add evidence upload limit per round
fix(auth): prevent race condition in token refresh
test(room): add ownership transfer edge cases
docs(readme): update API endpoint table
chore(ci): add Node.js 22 to test matrix
```

---

## Pull Request Süreci

### PR Açmadan Önce

1. `main` branch'ten güncel olduğunuzdan emin olun
2. Tüm testleri çalıştırın: `npm test`
3. Lint hatası olmadığını doğrulayın: `npm run lint`
4. Commit mesajlarınızı kontrol edin

### PR Şablonu

PR açarken otomatik şablon yüklenecektir. Lütfen tüm alanları doldurun.

### Review Süreci

1. CI pipeline'ın geçmesi gerekir (testler, güvenlik taraması, Docker build)
2. En az 1 maintainer onayı gerekir
3. Merge conflict'ler çözülmüş olmalıdır
4. Coverage düşürülmemelidir

### Merge Stratejisi

- Feature branch'ler **squash merge** ile birleştirilir
- Commit mesajı PR başlığını takip eder

---

## Test Yazma

Her kod değişikliği ile birlikte ilgili testler yazılmalıdır.

### Test Dosya Konumları

| Test Türü | Klasör | Kullanım |
|-----------|--------|----------|
| Unit | `tests/unit/` | Service, middleware, util fonksiyonları |
| Integration | `tests/integration/` | HTTP endpoint testleri (Supertest) |
| E2E | `tests/e2e/` | Socket.IO senaryo testleri |
| Security | `tests/security/` | Güvenlik testleri |

### Test İsimlendirme

```
tests/unit/feature.layer.test.js
tests/integration/feature.routes.test.js
tests/e2e/feature-scenario.test.js
```

### Temel Kurallar

- External dependency'ler `jest.mock()` ile mock'lanır
- Her test birbirinden bağımsızdır
- Test açıklamaları Türkçe veya İngilizce olabilir
- `testApp.js` ve `factories.js` helper'larını kullanın

---

## Sorularınız mı var?

Herhangi bir sorunuz varsa [Discussions](https://github.com/bcsakalar/katmanisimsehir/discussions) bölümünü kullanabilir veya bir issue açabilirsiniz.

Katkılarınız için teşekkür ederiz! 🎮
