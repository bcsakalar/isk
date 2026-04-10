<div align="center">

# Katman Isim Sehir

**Real-time multiplayer Turkish word game with retro pixel aesthetics**

[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?logo=socket.io)](https://socket.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![CI](https://github.com/bcsakalar/katmanisimsehir/actions/workflows/ci.yml/badge.svg)](https://github.com/bcsakalar/katmanisimsehir/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## About

**Katman Isim Sehir** brings the classic Turkish parlor game *"Isim Sehir"* (Name City) into the browser as a real-time multiplayer experience. Players join rooms, receive a random letter each round, and race to fill categories (Name, City, Animal, Plant, Country, and more) with words starting with that letter — then vote on each other's answers. Built with a retro pixel-art UI, the game supports 2–15 players per room, guest access, invite links, live chat, an evidence-upload system, and a full admin panel.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Scripts & Commands](#scripts--commands)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Project Structure](#project-structure)
- [API Overview](#api-overview)
- [WebSocket Events](#websocket-events)
- [Security](#security)
- [Database](#database)
- [Deployment](#deployment)
- [License](#license)

---

## How It Works

### 1. Sign In
- **Register** an account — persistent stats, XP, levels, and leaderboard rankings.
- **Guest login** — jump straight into a game with no sign-up (stats are not saved).

### 2. Lobby
Browse open rooms, see online player counts, room details (players, rounds, timer, categories), and join any room — or create your own.

### 3. Room Setup
The room owner configures the game:

| Setting | Options |
|---------|---------|
| **Rounds** | 1 – 15 |
| **Round Timer** | 30 s – 5 min |
| **Max Players** | 2 – 15 |
| **Voting Timer** | Timed (10–300 s) or Unlimited |
| **Answer Reveal** | Direct or Button (players reveal manually) |
| **Privacy** | Public or Password-protected |

**Categories** — starts with 5 defaults (Name, City, Animal, Plant, Country). Choose from 40+ built-in categories or add custom ones.

<details>
<summary>Built-in Categories</summary>

River, Mountain, Capital, Island, Lake, Fruit, Vegetable, Food, Beverage, Spice, Dessert, Movie, TV Series, Song, Book, Cartoon, Game, Profession, Celebrity, Historical Figure, Superhero, Mythology, Sport, Team, Object, Clothing, Color, Musical Instrument, Brand, Car Brand, Technology, English Word, Proverb / Idiom, Historical Event, and several fun/creative prompts.

</details>

**Letters** — toggle any of the 29 Turkish-alphabet letters on or off. Disable rare letters (Ğ, Ö, Ş, Ü, …) to make the game easier. At least 5 letters must stay active.

### 4. Gameplay
Once every player is ready, the owner starts the game.

1. A **random letter** appears on screen.
2. The **timer starts** — fill in each category with a word starting with that letter.
3. When time runs out (or everyone submits), answers are **locked**.
4. **Voting** begins.

### 5. Voting
All players' answers are displayed category by category.

- Vote each answer **✓ Correct** or **✗ Incorrect**.
- Identical answers across players are tagged **"SAME"**.
- **Evidence system** — upload up to 3 images per answer to prove its validity.
- In **Button** reveal mode, players choose when to reveal their own answers — adding a layer of strategy.

### 6. Scoring

| Condition | Points |
|-----------|--------|
| Unique answer + positive vote | **+10** per ✓ |
| Duplicate answer + positive vote | **+5** per ✓ |
| Negative vote | **-10** per ✗ (floored at 0) |
| Blank or wrong starting letter | **0** |

The winner of the game receives a **+50 XP bonus**.

### 7. Leaderboard & Leveling
- Registered players earn XP and level up.
- Weekly and monthly leaderboards.
- Guests are excluded from rankings.

---

## Features

- **Real-time multiplayer** — instant communication via Socket.IO (~48 event types)
- **Live chat** — lobby and in-room messaging with emoji reactions (👍 👏 😂 😮 😡 🔥 💯 ⭐)
- **Evidence system** — upload images during voting to back up your answers
- **Customizable categories** — 40+ built-in categories or create your own
- **Customizable letters** — enable/disable any letter from the 29-letter Turkish alphabet
- **Guest mode** — play instantly without registration
- **Invite links** — share a one-click room link with friends
- **Room ownership transfer** — hand off owner role to another player
- **Auto-reconnect** — seamless socket reconnection with automatic room rejoin
- **Admin panel** — user management, announcements, contact messages, audit logs
- **Retro pixel UI** — Press Start 2P font, pixel-art theme, responsive design
- **KVKK / GDPR compliance** — privacy consent, data export, account deletion scheduling
- **Contact form** — public contact page with admin inbox and read tracking
- **SEO ready** — Open Graph, Twitter Cards, JSON-LD, sitemap, robots.txt, PWA manifest

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 20 (Alpine) |
| **HTTP Framework** | Express 4 |
| **Database** | PostgreSQL 16 (raw SQL, pg driver, parameterized queries) |
| **Real-time** | Socket.IO 4 |
| **Frontend** | Vanilla JS SPA with History API routing |
| **Styling** | Tailwind CSS 3 |
| **Auth** | JWT access tokens (15 min) + refresh token rotation (7 day, SHA-256 hashed) + bcrypt |
| **Security** | Helmet CSP, DOMPurify (server-side), CORS, rate limiting (HTTP + WebSocket + event-based) |
| **Infrastructure** | Docker multi-stage build, dumb-init, Nginx reverse proxy, GitHub Actions CI |
| **Testing** | Jest 30 + Supertest 7 + Socket.IO Client (40 files, 483+ tests) |
| **Logging** | Winston |
| **Scheduling** | node-cron (6 background jobs) |

---

## Architecture

```
Client (Vanilla JS SPA)
  ├─ History API Router
  ├─ Reactive Store
  ├─ API module (fetch + JWT auto-refresh)
  └─ Socket.IO Client (auto-reconnect + room rejoin)
       │
       │  HTTP REST + WebSocket
       ▼
Express Server
  ├─ Middleware: Helmet → CORS → JSON (100 KB) → Rate Limit → Sanitizer → [Auth]
  ├─ HTTP Layer: 8 Routes → 8 Controllers → 8 Services → 6 Query modules → PostgreSQL
  ├─ Socket Layer: 5 Handlers (lobby, room, game, chat, admin)
  │     Middleware: socketAuth → socketSanitizer → socketRateLimit
  └─ Background: 6 Cron Jobs
       │
       │  pg driver (parameterized SQL)
       ▼
PostgreSQL 16 — 23+ tables, 11 migrations
```

### Module Boundaries

| Module | Can import | Cannot import |
|--------|-----------|--------------|
| Routes | Controllers, Middleware | Services, Queries, DB |
| Controllers | Services | Queries, DB directly |
| Services | Queries, Config, Utils | Routes, Controllers |
| Socket Handlers | Services, Queries | Routes, Controllers |
| Middleware | Config, Utils | Services, Controllers |
| Cron Jobs | Services | Routes, Controllers |

---

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/get-started) & Docker Compose (v2+)

### Quick Start

```bash
# Clone
git clone https://github.com/bcsakalar/katmanisimsehir.git
cd katmanisimsehir

# Create environment file
cp .env.example .env
# Edit .env with your secrets (JWT_SECRET, DB_PASSWORD, ADMIN_PASSWORD, etc.)

# Start development environment
docker compose -p isk -f docker-compose.dev.yml up --build

# Run migrations & seed data (first time only)
docker compose -p isk -f docker-compose.dev.yml exec app node server/db/migrate.js
docker compose -p isk -f docker-compose.dev.yml exec app node server/db/seed.js
```

Open [http://localhost:3007](http://localhost:3007) in your browser.

---

## Environment Variables

| Variable | Description | Default |
|----------|------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port inside container | `3000` |
| `DB_HOST` | PostgreSQL host | `db` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `katmanisimsehir` |
| `DB_USER` | Database user | `iskuser` |
| `DB_PASSWORD` | Database password | — |
| `JWT_SECRET` | Access token signing key | — (required in production) |
| `JWT_REFRESH_SECRET` | Refresh token signing key | — (required in production) |
| `ADMIN_USERNAME` | Default admin username | — |
| `ADMIN_PASSWORD` | Default admin password | — (required in production) |
| `CORS_ORIGIN` | Allowed CORS origin | `*` |
| `RATE_LIMIT_WINDOW_MS` | General rate limit window | `60000` |
| `RATE_LIMIT_MAX` | General rate limit max requests | `100` |

> **Important:** In production, `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `ADMIN_PASSWORD` must be set — the server will crash on startup if they fall back to defaults.

---

## Scripts & Commands

```bash
# Development (Docker)
npm run docker:dev           # docker compose -p isk -f docker-compose.dev.yml up --build
npm run docker:dev:down      # Tear down dev environment

# Production (Docker)
npm run docker:prod          # docker compose -p isk -f docker-compose.prod.yml up -d --build
npm run docker:prod:down     # Tear down prod environment
npm run docker:logs          # Tail production logs

# Database
npm run migrate              # node server/db/migrate.js
npm run seed                 # node server/db/seed.js

# CSS
npm run css:build            # Build & minify Tailwind CSS
npm run css:watch            # Watch mode for Tailwind

# Testing
npm test                     # Run all tests (--runInBand --forceExit)
npm run test:watch           # Watch mode
npm run test:coverage        # With coverage report

# Local (without Docker)
npm run dev                  # nodemon server/index.js
npm start                    # node server/index.js
```

### Port Map

| Service | Development | Production |
|---------|------------|------------|
| Node.js | `localhost:3007` | `127.0.0.1:3006` |
| PostgreSQL | `localhost:5437` | Internal (not exposed) |
| Nginx | — | `80 / 443` |

---

## Testing

The project has a comprehensive test suite built with **Jest 30** and **Supertest 7**.

| Category | Files | Description |
|----------|-------|-------------|
| **Unit** | 18 | Services, middleware, queries, utils |
| **Integration** | 6 | HTTP route tests via Supertest |
| **E2E** | 7 | Full Socket.IO multiplayer scenarios |
| **Socket** | 2 | Socket middleware (auth, rate limit) |
| **Security** | 3 | XSS, auth, input validation, RBAC, DoS |
| **Total** | **40 files** | **483+ tests** |

```bash
npm test                     # Run all tests
npm run test:coverage        # Generate coverage report
```

### Test Architecture

- **Unit tests** — external dependencies mocked with `jest.mock()`, no DB required.
- **Integration tests** — Express app via `testApp.js` helper + Supertest, service layer mocked.
- **E2E tests** — real Socket.IO server with multi-player scenarios, stress tests (up to 15 concurrent players), disconnect/reconnect flows.
- **Security tests** — XSS payload testing, JWT manipulation, privilege escalation, rate limiting, input truncation.

---

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push to `main`/`develop` and on pull requests:

1. **Test** — install, run full test suite, generate coverage report, upload as artifact.
2. **Security Audit** — `npm audit --omit=dev`.
3. **Docker Build** — build the production Docker image to verify it compiles.

---

## Project Structure

```
katmanisimsehir/
├─ server/
│  ├─ index.js                    # Entry point: middleware → routes → socket → cron → listen
│  ├─ config/
│  │  ├─ env.js                   # Env parser + production safety checks
│  │  ├─ database.js              # pg Pool + query() + transaction() helpers
│  │  └─ cors.js                  # CORS configuration
│  ├─ middleware/
│  │  ├─ auth.js                  # JWT auth, ban check, optional auth
│  │  ├─ adminGuard.js            # Admin role guard (async DB lookup)
│  │  ├─ helmet.js                # CSP + HSTS + Permissions-Policy
│  │  ├─ rateLimiter.js           # 5 rate limiters (general, auth, register, api, contact)
│  │  └─ sanitizer.js             # DOMPurify server-side XSS protection
│  ├─ routes/                     # 8 route files (auth, room, game, user, admin, leaderboard, contact, kvkk)
│  ├─ controllers/                # 8 controller files
│  ├─ services/                   # 8 service files (business logic layer)
│  │  ├─ auth.service.js          # Register, login, guest login, JWT, refresh rotation, account lockout
│  │  ├─ game.service.js          # Game lifecycle, rounds, voting, evidence
│  │  ├─ room.service.js          # Room CRUD, join/leave, ownership transfer, settings
│  │  ├─ scoring.service.js       # Base scoring + vote scoring
│  │  ├─ answer.service.js        # Answer validation, duplicate detection
│  │  ├─ cleanup.service.js       # Inactive room/session/chat/guest cleanup
│  │  ├─ contact.service.js       # Contact form submission & management
│  │  └─ kvkk.service.js          # Privacy consent, data export, account deletion
│  ├─ db/
│  │  ├─ migrate.js               # Sequential migration runner
│  │  ├─ seed.js                  # Category + admin user seeder
│  │  ├─ migrations/              # 11 SQL migration files (001–011)
│  │  ├─ queries/                 # 6 query modules (users, rooms, games, categories, chat, kvkk)
│  │  └─ seeds/                   # SQL seed files
│  ├─ socket/
│  │  ├─ index.js                 # Socket.IO server init + middleware + handler registration
│  │  ├─ middleware/              # socketAuth, socketRateLimit, socketSanitizer
│  │  └─ handlers/                # 5 handlers (lobby, room, game, chat, admin)
│  ├─ jobs/                       # 6 cron jobs (roomCleanup, sessionCleanup, chatPurge,
│  │                              #   leaderboardReset, accountDeletion, guestCleanup)
│  └─ utils/
│     ├─ errors.js                # AppError hierarchy (400–429)
│     ├─ logger.js                # Winston logger
│     ├─ letterPool.js            # Turkish alphabet frequency pool
│     └─ crypto.js                # Room code + secure token generation
├─ client/
│  ├─ index.html                  # SPA shell (OG, JSON-LD, meta tags, self-hosted deps)
│  ├─ manifest.json               # PWA manifest
│  ├─ robots.txt / sitemap.xml    # SEO
│  ├─ css/
│  │  ├─ tailwind.css             # Tailwind input
│  │  └─ output.css               # Built CSS (gitignored)
│  └─ js/
│     ├─ app.js                   # App bootstrapper (auth guard, socket, router)
│     ├─ socket.js                # Socket.IO wrapper (reconnect + auto-rejoin)
│     ├─ views/                   # 12 SPA views (auth, lobby, room, game, voting,
│     │                           #   scoreboard, leaderboard, profile, contact, privacy, invite, error)
│     ├─ components/              # 7 reusable components (chat, modal, notification,
│     │                           #   timer, toast, categoryEditor, letterSelector)
│     └─ utils/                   # router, store, api, validators
├─ admin/
│  ├─ index.html                  # Admin panel HTML
│  └─ js/admin-app.js             # Admin SPA (users, rooms, announcements, contact inbox, logs)
├─ nginx/
│  ├─ configs/                    # isk.conf, isk-ssl-params.conf, rate-limit.conf, isk-temp-http.conf
│  └─ scripts/                    # nginx-deploy.sh
├─ tests/                         # 40 test files (see Testing section)
├─ Dockerfile                     # Multi-stage: base → dev → build → production
├─ docker-compose.dev.yml         # Dev: App:3007, DB:5437
├─ docker-compose.prod.yml        # Prod: App:3006, DB:internal
├─ docker-entrypoint.sh           # Container entrypoint (migrate + seed + start)
├─ jest.config.js                 # Jest configuration
├─ tailwind.config.js             # Retro gaming theme (Press Start 2P, pixel colors)
└─ package.json                   # Dependencies & scripts
```

---

## API Overview

All routes are prefixed with `/api`.

| Endpoint Group | Auth | Description |
|----------------|------|-------------|
| `POST /api/auth/register` | — | Register a new account |
| `POST /api/auth/login` | — | Login (account lockout after 5 failures) |
| `POST /api/auth/guest` | — | Guest login (temporary account) |
| `POST /api/auth/refresh` | — | Refresh token rotation |
| `POST /api/auth/logout` | JWT | Logout (invalidate refresh token) |
| `GET /api/auth/me` | JWT | Current user profile |
| `GET /api/rooms` | JWT | List active rooms |
| `POST /api/rooms` | JWT | Create a room |
| `POST /api/rooms/:id/join` | JWT | Join a room |
| `POST /api/rooms/:id/leave` | JWT | Leave a room |
| `PUT /api/rooms/:id/settings` | JWT | Update room settings (owner only) |
| `GET /api/game/categories` | JWT | List available categories |
| `GET /api/leaderboard` | JWT | Weekly/monthly leaderboard |
| `GET /api/users/me` | JWT | User profile & stats |
| `PUT /api/users/me` | JWT | Update profile |
| `POST /api/contact` | — | Submit contact message (rate limited: 3/hour) |
| `POST /api/kvkk/accept-privacy` | JWT | Accept privacy policy |
| `GET /api/kvkk/export` | JWT | Export all personal data (JSON) |
| `POST /api/kvkk/request-deletion` | JWT | Request account deletion (30-day grace) |
| `GET /api/admin/*` | Admin | User/room management, contact inbox, audit logs |

---

## WebSocket Events

### Lobby
| Event | Direction | Description |
|-------|-----------|-------------|
| `lobby:refresh` | Client → Server | Request updated room list |
| `lobby:rooms` | Server → Client | Room list payload |
| `lobby:online_count` | Server → Client | Online player count |

### Room
| Event | Direction | Description |
|-------|-----------|-------------|
| `room:join` | Client → Server | Join room (code + password) |
| `room:leave` | Client → Server | Leave room |
| `room:ready` | Client → Server | Toggle ready state |
| `room:rejoin` | Client → Server | Auto-rejoin on reconnect |
| `room:settings_updated` | Server → Room | Settings changed |
| `room:categories_updated` | Server → Room | Categories changed |
| `room:players_updated` | Server → Room | Player list updated |
| `room:transfer_ownership` | Client → Server | Transfer owner role |
| `room:owner_changed` | Server → Room | New owner announced |

### Game
| Event | Direction | Description |
|-------|-----------|-------------|
| `game:start` | Client → Server | Start game (owner only) |
| `game:started` | Server → Room | Game started with round info |
| `game:submit_answers` | Client → Server | Submit round answers |
| `game:round_finished` | Server → Room | Round ended, voting begins |
| `game:vote` | Client → Server | Cast vote on an answer |
| `game:upload_image` | Client → Server | Upload evidence image |
| `game:end_voting` | Client → Server | End voting (owner only) |
| `game:voting_finished` | Server → Room | Voting results + scores |
| `game:game_finished` | Server → Room | Final results |

### Chat
| Event | Direction | Description |
|-------|-----------|-------------|
| `chat:room` | Client → Server | Send chat message |
| `chat:room_message` | Server → Room | Broadcast message |
| `chat:reaction` | Bidirectional | Emoji reaction (8 supported) |

---

## Security

The application implements defense-in-depth across multiple layers:

- **Helmet** — strict CSP (no `unsafe-inline`), HSTS, Permissions-Policy, X-Content-Type-Options
- **DOMPurify** — server-side sanitization of all inputs (HTTP + WebSocket) with depth limiting
- **Rate limiting** — 5 HTTP limiters (general, auth, register, api, contact) + WebSocket event-based limiting
- **Authentication** — JWT with short-lived access tokens (15 min), refresh token one-time rotation with SHA-256 hashing, account lockout (5 failed attempts → 15-min lock)
- **Authorization** — Admin guard with async DB role verification (not just JWT claims)
- **Input validation** — parameterized SQL queries ($1, $2), size limits on all inputs, object key limits
- **CORS** — configurable origin policy with credentials
- **Docker** — non-root user, `no-new-privileges`, `read_only` filesystem, dumb-init PID 1
- **Nginx** — SSL termination, DDoS rate limiting, static file caching, proxy buffer tuning
- **Password policy** — minimum 8 characters, bcrypt (12 rounds)

---

## Database

**PostgreSQL 16** with raw SQL and parameterized queries (no ORM).

- **23+ tables** — users, user_sessions, rooms, room_players, room_categories, categories, game_rounds, player_answers, answer_votes, answer_images, chat_messages, announcements, admin_logs, reports, achievements, user_achievements, leaderboard, tournaments, privacy_consents, user_deletions, contact_messages, and more.
- **11 migrations** — sequential SQL files from initial schema to latest cleanup.
- **Connection pool** — max 20, idle timeout 30 s, connection timeout 5 s, statement timeout 10 s.
- **Transactions** — `transaction(callback)` helper with automatic BEGIN/COMMIT/ROLLBACK.

### Background Jobs

| Job | Schedule | Action |
|-----|----------|--------|
| Room Cleanup | Every 5 min | Abandon rooms inactive for 30+ min |
| Session Cleanup | Every hour | Delete expired refresh tokens |
| Chat Purge | Daily 03:00 | Delete messages older than 7 days |
| Leaderboard Reset | Sunday 00:00 | Snapshot weekly leaderboard |
| Account Deletion | Daily 03:30 | Process scheduled deletion requests |
| Guest Cleanup | Every 30 min | Delete expired guest accounts |

---

## Deployment

### Production with Docker

```bash
# Build and start production containers
docker compose -p isk -f docker-compose.prod.yml up -d --build

# Run migrations
docker compose -p isk -f docker-compose.prod.yml exec app node server/db/migrate.js

# Seed initial data
docker compose -p isk -f docker-compose.prod.yml exec app node server/db/seed.js

# View logs
docker compose -p isk -f docker-compose.prod.yml logs -f app --tail=100
```

### Nginx

Production Nginx configuration files are provided in [`nginx/configs/`](nginx/configs/):

- `isk.conf` — server block with SSL, static caching, Socket.IO proxy
- `isk-ssl-params.conf` — OCSP stapling, session cache, protocols
- `rate-limit.conf` — API and auth rate limiting zones
- `isk-temp-http.conf` — temporary HTTP-only config for initial SSL setup

Deploy script: [`nginx/scripts/nginx-deploy.sh`](nginx/scripts/nginx-deploy.sh)

### Docker Image Details

- **Multi-stage build**: `base` → `development` → `build` (Tailwind CSS) → `production`
- **Production image**: Node.js 20 Alpine, production-only deps, dumb-init, non-root user (`iskuser`)
- **Health check**: `GET /api/health` every 30 s
- **Security**: `security_opt: no-new-privileges`, `read_only` root filesystem, tmpfs for logs

---

## License

This project is licensed under the [MIT License](LICENSE).

Copyright (c) 2026 [bcsakalar](https://github.com/bcsakalar)
