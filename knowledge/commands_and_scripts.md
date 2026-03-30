# Komutlar ve Scriptler — Katman İsim Şehir

## package.json Scriptleri

| Komut | Açıklama |
|-------|----------|
| `npm start` | `node server/index.js` — Production sunucu başlat |
| `npm run dev` | `nodemon server/index.js` — Development (auto-restart) |
| `npm run migrate` | `node server/db/migrate.js` — DB migration |
| `npm run seed` | `node server/db/seed.js` — DB seeding |
| `npm run css:build` | `npx tailwindcss -i ./client/css/tailwind.css -o ./client/css/output.css --minify` |
| `npm run css:watch` | `npx tailwindcss -i ./client/css/tailwind.css -o ./client/css/output.css --watch` |
| `npm test` | `jest --runInBand --forceExit` — Tüm testleri çalıştır (36 dosya, 442 test) |
| `npm run test:watch` | `jest --watch --runInBand` — Watch modunda testler |
| `npm run test:coverage` | `jest --coverage --runInBand --forceExit` — Coverage raporu ile |
| `npm run docker:dev` | `docker compose -p isk -f docker-compose.dev.yml up --build` |
| `npm run docker:dev:down` | `docker compose -p isk -f docker-compose.dev.yml down` |
| `npm run docker:prod` | `docker compose -p isk -f docker-compose.prod.yml up -d --build` |
| `npm run docker:prod:down` | `docker compose -p isk -f docker-compose.prod.yml down` |
| `npm run docker:logs` | `docker compose -p isk -f docker-compose.prod.yml logs -f app --tail=100` |

## Docker Komutları

### Development
```bash
# Başlat (build ile)
docker compose -p isk -f docker-compose.dev.yml up --build

# Arka planda başlat
docker compose -p isk -f docker-compose.dev.yml up -d --build

# Logları izle
docker compose -p isk -f docker-compose.dev.yml logs -f app

# Durdur
docker compose -p isk -f docker-compose.dev.yml down

# Temiz başlangıç (volume sil — DB verileri kaybolur)
docker compose -p isk -f docker-compose.dev.yml down -v

# Container içinde komut çalıştır
docker compose -p isk -f docker-compose.dev.yml exec app node server/db/migrate.js
docker compose -p isk -f docker-compose.dev.yml exec app node server/db/seed.js

# DB'ye doğrudan bağlan
docker compose -p isk -f docker-compose.dev.yml exec db psql -U iskuser -d katmanisimsehir
```

### Production
```bash
# Deploy (arka planda)
docker compose -p isk -f docker-compose.prod.yml up -d --build

# Logları izle
docker compose -p isk -f docker-compose.prod.yml logs -f app --tail=100

# Container durumları
docker compose -p isk -f docker-compose.prod.yml ps

# Yedek al
docker compose -p isk -f docker-compose.prod.yml exec db pg_dump -U $DB_USER katmanisimsehir > backup.sql

# Yedekten geri yükle
cat backup.sql | docker compose -p isk -f docker-compose.prod.yml exec -T db psql -U $DB_USER -d katmanisimsehir
```

## Dockerfile Aşamaları

```
base    → Node.js 20-alpine, npm ci (production deps)
dev     → base + nodemon + volume mount
build   → base + Tailwind CSS compile
prod    → Node.js 20-alpine, sadece production deps + built assets, non-root user
```

## Port Tablosu

| Servis | Development | Production |
|--------|------------|------------|
| Node.js (Express) | localhost:3007 | 127.0.0.1:3006 |
| PostgreSQL | localhost:5437 | iç ağ (expose yok) |
| Nginx | — | 80 + 443 (SSL) |

## VPS Nginx Kurulumu

```bash
# Config dosyalarını kopyala
sudo cp /opt/katmanisimsehir/nginx/isk.conf /etc/nginx/sites-available/
sudo cp /opt/katmanisimsehir/nginx/security.conf /etc/nginx/snippets/

# Aktifleştir
sudo ln -s /etc/nginx/sites-available/isk.conf /etc/nginx/sites-enabled/

# Test et ve yükle
sudo nginx -t
sudo systemctl reload nginx

# SSL sertifikası (Let's Encrypt)
sudo certbot --nginx -d isimsehir.example.com
```

## Docker Olmadan Lokal Çalıştırma

```bash
# Önkoşul: PostgreSQL lokal kurulu ve çalışıyor olmalı
# .env dosyasını düzenle: DB_HOST=localhost, DB_PORT=5432

npm install
npm run migrate
npm run seed
npm run css:build
npm run dev

# Tarayıcıda: http://localhost:3000 (PORT .env'den okunur)
```

## Ortam Değişkenleri (.env.example)

| Değişken | Varsayılan | Açıklama |
|----------|-----------|----------|
| NODE_ENV | development | production'da güvenlik kontrolleri aktif |
| PORT | 3000 | Express dinleme portu |
| DB_HOST | localhost | PostgreSQL host |
| DB_PORT | 5432 | PostgreSQL port |
| DB_NAME | katmanisimsehir | Veritabanı adı |
| DB_USER | postgres | DB kullanıcısı |
| DB_PASSWORD | — | **production'da zorunlu** |
| JWT_SECRET | — | **production'da varsayılan olamaz** |
| JWT_REFRESH_SECRET | — | **production'da varsayılan olamaz** |
| JWT_EXPIRES_IN | 15m | Access token ömrü |
| JWT_REFRESH_EXPIRES_IN | 7d | Refresh token ömrü |
| CORS_ORIGIN | http://localhost:3007 | İzin verilen origin |
| ADMIN_INITIAL_USERNAME | admin | Seed admin kullanıcı adı |
| ADMIN_INITIAL_EMAIL | admin@katmanisimsehir.com | Seed admin e-posta |
| ADMIN_INITIAL_PASSWORD | — | Seed admin şifresi |
| RATE_LIMIT_WINDOW_MS | 60000 | Rate limit penceresi (ms) |
| RATE_LIMIT_MAX_REQUESTS | 100 | Max istek sayısı |
| ROOM_INACTIVE_MINUTES | 30 | Oda inaktiflik süresi |
| CHAT_RETENTION_DAYS | 7 | Chat saklama süresi |
| SESSION_CLEANUP_HOURS | 1 | Session temizleme aralığı |

## Tailwind CSS

```bash
# Tek seferlik build (production)
npx tailwindcss -i ./client/css/tailwind.css -o ./client/css/output.css --minify

# Watch modu (development)
npx tailwindcss -i ./client/css/tailwind.css -o ./client/css/output.css --watch
```

Tema: Retro gaming estetiği
- Fontlar: `Press Start 2P` (başlıklar), `VT323` (oyun), `Space Mono` (genel)
- Renkler: retro-bg (#1a1a2e), retro-surface (#16213e), retro-accent (#e94560), retro-secondary (#0f3460), retro-gold (#f0a500), retro-success (#4ecca3), retro-text (#eee)
- Animasyonlar: glow, slide-up, bounce-in, score-pop

## Faydalı Tek Satırlık Komutlar

```bash
# npm audit (güvenlik kontrolü)
npm audit

# Bağımlılık güncelleme
npm update

# Container loglarında arama
docker compose -p isk -f docker-compose.dev.yml logs app | grep "ERROR"

# DB tablo listesi
docker compose -p isk -f docker-compose.dev.yml exec db psql -U iskuser -d katmanisimsehir -c "\dt"

# DB tablo detayı
docker compose -p isk -f docker-compose.dev.yml exec db psql -U iskuser -d katmanisimsehir -c "\d+ users"
```
