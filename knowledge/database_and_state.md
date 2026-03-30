# Veritabanı ve State — Katman İsim Şehir

> Son güncelleme: 2026-03-30

## Veritabanı Teknolojisi

| Alan | Değer |
|------|-------|
| DBMS | PostgreSQL 16 |
| Driver | pg (node-postgres) ^8.20.0 |
| ORM | Yok — raw SQL + parameterized queries |
| Pool | max: 20, idle: 30s, connection timeout: 5s, statement timeout: 10s |
| Transaction | `transaction(callback)` helper: BEGIN → callback(client) → COMMIT / ROLLBACK |
| Migration | 11 sıralı SQL dosyası: `server/db/migrations/001_*.sql` ... `011_*.sql` |
| Seeding | SQL + Node.js: kategoriler/başarımlar SQL, admin kullanıcı bcrypt ile dinamik |

### Migration Dosyaları

| Dosya | Açıklama |
|-------|----------|
| 001_initial_schema.sql | Ana şema: users, rooms, game_rounds, player_answers, chat, admin, tournaments +19 tablo |
| 002_answer_challenges.sql | answer_challenges tablosu |
| 003_schema_fixes.sql | categories.description ekleme, achievements condition→JSONB |
| 004_remove_email_required_add_guest.sql | email nullable, is_guest, guest_expires_at |
| 005_game_v2_overhaul.sql | Oylama sistemi: answer_votes, answer_images, rooms yeni sütunlar, layer/combo kaldırma |
| 006_fix_role_check_guest.sql | Role CHECK constraint'e 'guest' ekleme |
| 007_voting_timer_constraint.sql | voting_timer: 0 (süresiz) veya 10-300 |
| 008_security_kvkk.sql | Account lockout, privacy_consents, user_deletions |
| 009_contact_messages.sql | contact_messages tablosu |
| 010_drop_joker_tables.sql | player_jokers + joker_types tabloları kaldırıldı |
| 011_cleanup_custom_categories.sql | Kullanıcı eklediği geçersiz kategoriler temizlendi |

## Tablo Şeması (23+ Tablo)

### 1. users
Kullanıcı profilleri, auth ve güvenlik.

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| id | BIGINT | PK, GENERATED ALWAYS AS IDENTITY |
| username | TEXT | NOT NULL, UNIQUE |
| email | TEXT | UNIQUE (nullable — misafirler için), partial index WHERE email IS NOT NULL |
| password_hash | TEXT | NOT NULL (bcrypt 12 round) |
| display_name | TEXT | NOT NULL |
| avatar_url | TEXT | nullable |
| role | TEXT | DEFAULT 'player', CHECK: player/moderator/admin/guest |
| xp | INTEGER | DEFAULT 0 |
| level | INTEGER | DEFAULT 1 |
| total_wins | INTEGER | DEFAULT 0 |
| total_games | INTEGER | DEFAULT 0 |
| is_banned | BOOLEAN | DEFAULT FALSE |
| ban_reason | TEXT | nullable |
| failed_login_attempts | INTEGER | DEFAULT 0 |
| locked_until | TIMESTAMPTZ | nullable |
| is_guest | BOOLEAN | DEFAULT FALSE |
| guest_expires_at | TIMESTAMPTZ | nullable |
| privacy_accepted_at | TIMESTAMPTZ | nullable |
| privacy_version | TEXT | nullable |
| deletion_requested_at | TIMESTAMPTZ | nullable |
| last_login_at | TIMESTAMPTZ | nullable |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now(), trigger ile güncellenir |

Indexler: `idx_users_username`, `idx_users_email` (partial), `idx_users_role`, `idx_users_guest_cleanup` (partial)

### 2. user_sessions
Refresh token yönetimi.

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| id | BIGINT | PK |
| user_id | BIGINT | FK → users.id CASCADE |
| refresh_token | TEXT | NOT NULL, UNIQUE (SHA-256 hash) |
| ip_address | INET | nullable |
| user_agent | TEXT | nullable |
| expires_at | TIMESTAMPTZ | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |

Indexler: `idx_sessions_user_id`, `idx_sessions_expires`

### 3. categories
Oyun kategorileri (sadece varsayılan kategoriler, custom kategoriler migration 011 ile temizlendi).

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| id | BIGINT | PK |
| name | TEXT | NOT NULL, UNIQUE |
| slug | TEXT | NOT NULL, UNIQUE |
| description | TEXT | nullable |
| icon | TEXT | nullable |
| is_default | BOOLEAN | DEFAULT FALSE (5 tane TRUE) |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | TIMESTAMPTZ | DEFAULT now() |

Varsayılan kategoriler: İsim, Şehir, Hayvan, Bitki, Ülke
Ek kategoriler: Nehir, Dağ, Meyve, Sebze, Meslek, Eşya, Renk, Araba Markası, Film, Yiyecek, İçecek, Spor, Müzik Aleti, Ünlü, Oyun

### 4. rooms
Oyun odaları.

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| id | BIGINT | PK |
| code | TEXT | NOT NULL, UNIQUE (6 char) |
| name | TEXT | NOT NULL |
| owner_id | BIGINT | FK → users.id SET NULL |
| status | TEXT | DEFAULT 'waiting', CHECK: waiting/playing/paused/finished/abandoned |
| game_mode | TEXT | DEFAULT 'classic' |
| max_players | INTEGER | DEFAULT 8, CHECK: 2-15 |
| total_rounds | INTEGER | DEFAULT 5 |
| time_per_round | INTEGER | DEFAULT 90 (30-300 saniye) |
| current_round | INTEGER | DEFAULT 0 |
| is_private | BOOLEAN | DEFAULT FALSE |
| password_hash | TEXT | nullable (bcrypt) |
| answer_reveal_mode | TEXT | DEFAULT 'direct', CHECK: direct/button |
| enabled_letters | TEXT | DEFAULT 'A,B,C,Ç,...,Z' (29 Türkçe harf) |
| voting_timer | INTEGER | DEFAULT 60, CHECK: 0 OR 10-300 (0=süresiz) |
| last_activity | TIMESTAMPTZ | DEFAULT now() |
| started_at | TIMESTAMPTZ | nullable |
| finished_at | TIMESTAMPTZ | nullable |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | trigger ile güncellenir |

### 5. room_players
Oda-oyuncu ilişkisi.

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| id | BIGINT | PK |
| room_id | BIGINT | FK → rooms.id CASCADE |
| user_id | BIGINT | FK → users.id CASCADE |
| total_score | INTEGER | DEFAULT 0 |
| is_ready | BOOLEAN | DEFAULT FALSE |
| is_eliminated | BOOLEAN | DEFAULT FALSE |
| joined_at | TIMESTAMPTZ | DEFAULT now() |
| left_at | TIMESTAMPTZ | nullable |
| UNIQUE | | (room_id, user_id) |

### 6. room_categories
Oda-kategori ilişkisi (M:N).

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| room_id | BIGINT | PK parçası, FK → rooms.id CASCADE |
| category_id | BIGINT | PK parçası, FK → categories.id CASCADE |
| sort_order | INTEGER | DEFAULT 0 |

### 7. game_rounds
Tur bilgileri.

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| id | BIGINT | PK |
| room_id | BIGINT | FK → rooms.id CASCADE |
| round_number | INTEGER | NOT NULL |
| letter | CHAR(1) | NOT NULL |
| voting_started_at | TIMESTAMPTZ | nullable |
| voting_finished_at | TIMESTAMPTZ | nullable |
| started_at | TIMESTAMPTZ | DEFAULT now() |
| finished_at | TIMESTAMPTZ | nullable |
| UNIQUE | | (room_id, round_number) |

### 8. player_answers
Oyuncu cevapları.

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| id | BIGINT | PK |
| round_id | BIGINT | FK → game_rounds.id CASCADE |
| player_id | BIGINT | FK → room_players.id CASCADE |
| category_id | BIGINT | FK → categories.id |
| answer | TEXT | DEFAULT '' |
| is_valid | BOOLEAN | nullable |
| is_duplicate | BOOLEAN | DEFAULT FALSE |
| base_score | INTEGER | DEFAULT 0 |
| vote_score | INTEGER | DEFAULT 0 |
| is_challenged | BOOLEAN | DEFAULT FALSE |
| submitted_at | TIMESTAMPTZ | DEFAULT now() |
| UNIQUE | | (round_id, player_id, category_id) |

### 9. answer_votes
Oylama kayıtları (Migration 005).

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| id | BIGINT | PK |
| answer_id | BIGINT | FK → player_answers.id CASCADE |
| voter_id | BIGINT | FK → room_players.id CASCADE |
| vote_type | TEXT | NOT NULL, CHECK: positive/negative |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| UNIQUE | | (answer_id, voter_id) |

Indexler: `idx_votes_answer`, `idx_votes_voter`

### 10. answer_images
Kanıt resimleri (Migration 005).

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| id | BIGINT | PK |
| answer_id | BIGINT | FK → player_answers.id CASCADE |
| uploaded_by | BIGINT | FK → room_players.id CASCADE |
| image_data | TEXT | NOT NULL (base64) |
| mime_type | TEXT | DEFAULT 'image/jpeg' |
| created_at | TIMESTAMPTZ | DEFAULT now() |

Indexler: `idx_images_answer`

### 11. answer_challenges
İtiraz kayıtları (Migration 002 — eski sistem, hâlâ tabloda).

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| id | BIGINT | PK |
| answer_id | BIGINT | FK → player_answers.id CASCADE |
| challenger_id | BIGINT | FK → room_players.id CASCADE |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| UNIQUE | | (answer_id, challenger_id) |

### 12. achievements
Başarım tanımları.

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| id | BIGINT | PK |
| name | TEXT | NOT NULL |
| slug | TEXT | NOT NULL, UNIQUE |
| description | TEXT | nullable |
| icon | TEXT | nullable |
| xp_reward | INTEGER | DEFAULT 0 |
| condition | JSONB | nullable |
| is_active | BOOLEAN | DEFAULT TRUE |

### 13. user_achievements
Kullanıcı-başarım ilişkisi (M:N).

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| user_id | BIGINT | PK parçası, FK → users.id CASCADE |
| achievement_id | BIGINT | PK parçası, FK → achievements.id CASCADE |
| earned_at | TIMESTAMPTZ | DEFAULT now() |

### 14. leaderboard
Haftalık/aylık sıralama.

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| id | BIGINT | PK |
| user_id | BIGINT | FK → users.id CASCADE |
| season | TEXT | NOT NULL |
| period_type | TEXT | CHECK: weekly/monthly/season |
| total_score | INTEGER | DEFAULT 0 |
| total_wins | INTEGER | DEFAULT 0 |
| games_played | INTEGER | DEFAULT 0 |
| rank | INTEGER | nullable |
| updated_at | TIMESTAMPTZ | trigger |
| UNIQUE | | (user_id, season, period_type) |

Sorgu kalıbı: `INSERT ... ON CONFLICT DO UPDATE` (UPSERT)

### 15. chat_messages
Oda/lobi sohbet mesajları.

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| id | BIGINT | PK |
| room_id | BIGINT | FK → rooms.id CASCADE, nullable (lobi chat) |
| user_id | BIGINT | FK → users.id SET NULL |
| message | TEXT | NOT NULL (1-500 char) |
| is_system | BOOLEAN | DEFAULT FALSE |
| is_deleted | BOOLEAN | DEFAULT FALSE (soft delete) |
| created_at | TIMESTAMPTZ | DEFAULT now() |

### 16. admin_logs
Admin işlem kaydı.

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| id | BIGINT | PK |
| admin_id | BIGINT | FK → users.id |
| action | TEXT | NOT NULL |
| target_type | TEXT | "user", "room", "announcement", "contact" |
| target_id | BIGINT | nullable |
| details | JSONB | ek bilgi |
| ip_address | INET | nullable |
| created_at | TIMESTAMPTZ | DEFAULT now() |

### 17. announcements
Duyurular.

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| id | BIGINT | PK |
| admin_id | BIGINT | FK → users.id |
| title | TEXT | NOT NULL |
| content | TEXT | NOT NULL |
| target | TEXT | DEFAULT 'all', CHECK: all/lobby/room |
| target_room_id | BIGINT | FK → rooms.id SET NULL |
| is_active | BOOLEAN | DEFAULT TRUE |
| expires_at | TIMESTAMPTZ | nullable |
| created_at | TIMESTAMPTZ | DEFAULT now() |

### 18. tournaments
Turnuva bracket yönetimi (DB tabloları mevcut, servis implementasyonu minimal).

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| id | BIGINT | PK |
| name | TEXT | NOT NULL |
| created_by | BIGINT | FK → users.id |
| status | TEXT | DEFAULT 'registering', CHECK: registering/in_progress/finished/cancelled |
| max_participants | INTEGER | DEFAULT 16 |
| bracket_data | JSONB | bracket yapısı |
| winner_id | BIGINT | FK → users.id, nullable |
| started_at, finished_at, created_at | TIMESTAMPTZ | |

### 19. tournament_participants
Turnuva katılımcıları.

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| tournament_id | BIGINT | PK parçası, FK → tournaments.id CASCADE |
| user_id | BIGINT | PK parçası, FK → users.id CASCADE |
| seed | INTEGER | nullable |
| is_eliminated | BOOLEAN | DEFAULT FALSE |
| final_rank | INTEGER | nullable |
| joined_at | TIMESTAMPTZ | DEFAULT now() |

### 20. reports
Moderasyon raporları.

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| id | BIGINT | PK |
| reporter_id | BIGINT | FK → users.id |
| reported_user_id | BIGINT | FK → users.id |
| room_id | BIGINT | FK → rooms.id, nullable |
| reason | TEXT | NOT NULL |
| status | TEXT | DEFAULT 'pending', CHECK: pending/reviewed/resolved/dismissed |
| admin_note | TEXT | nullable |
| reviewed_by | BIGINT | FK → users.id, nullable |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| reviewed_at | TIMESTAMPTZ | nullable |

### 21. privacy_consents
KVKK gizlilik onay kayıtları (Migration 008).

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| id | BIGINT | PK |
| user_id | BIGINT | FK → users.id CASCADE |
| consent_type | TEXT | NOT NULL, CHECK: privacy_policy/terms_of_service |
| accepted | BOOLEAN | DEFAULT TRUE |
| consent_version | TEXT | DEFAULT '1.0' |
| ip_address | INET | nullable |
| user_agent | TEXT | nullable |
| created_at | TIMESTAMPTZ | DEFAULT now() |

Indexler: `idx_privacy_consents_user`

### 22. user_deletions
Hesap silme talep kuyruğu (Migration 008).

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| id | BIGINT | PK |
| user_id | BIGINT | UNIQUE, FK → users.id CASCADE |
| requested_at | TIMESTAMPTZ | DEFAULT now() |
| scheduled_for | TIMESTAMPTZ | NOT NULL |
| completed_at | TIMESTAMPTZ | nullable |
| reason | TEXT | nullable |
| ip_address | INET | nullable |

Indexler: `idx_user_deletions_scheduled` (partial: WHERE completed_at IS NULL)

### 23. contact_messages
İletişim formu mesajları (Migration 009).

| Sütun | Tip | Kısıtlama |
|-------|-----|-----------|
| id | BIGINT | PK |
| name | VARCHAR(100) | NOT NULL |
| email | VARCHAR(255) | NOT NULL |
| subject | VARCHAR(200) | NOT NULL |
| message | TEXT | NOT NULL |
| ip_address | INET | nullable |
| is_read | BOOLEAN | DEFAULT FALSE |
| read_by | BIGINT | FK → users.id, nullable |
| read_at | TIMESTAMPTZ | nullable |
| created_at | TIMESTAMPTZ | DEFAULT now() |

Indexler: `idx_contact_messages_is_read`, `idx_contact_messages_created_at`

## İlişki Diyagramı

```
users ─┬→ user_sessions (1:N)
       ├→ rooms [owner] (1:N)
       ├→ room_players (1:N)
       ├→ chat_messages (1:N)
       ├→ user_achievements (M:N → achievements)
       ├→ admin_logs (1:N)
       ├→ reports [reporter + reported] (1:N)
       ├→ announcements (1:N)
       ├→ leaderboard (1:N)
       ├→ tournaments [creator + winner] (1:N)
       ├→ privacy_consents (1:N)
       ├→ user_deletions (1:1)
       └→ contact_messages [read_by] (1:N)

rooms ─┬→ room_players (1:N)
       ├→ room_categories (M:N → categories)
       ├→ game_rounds (1:N)
       └→ chat_messages (1:N)

game_rounds ──→ player_answers (1:N)
player_answers ─┬→ answer_votes (1:N)
                ├→ answer_images (1:N)
                └→ answer_challenges (1:N)
room_players ──→ player_answers (1:N)
room_players ──→ answer_votes [voter] (1:N)
room_players ──→ answer_images [uploader] (1:N)
```

## Sorgu Dosyaları

| Dosya | Ana Fonksiyonlar |
|-------|-----------------|
| users.queries.js | create, findById, findByUsername, findByEmail, updateScore, ban, unban, deleteExpiredGuests, getLeaderboard |
| rooms.queries.js | findById, findByCode, create, updateStatus, setStarted, setFinished, incrementRound, updateSettings, listActive, getPlayers, getPlayerCount, addPlayer, removePlayer, getCategories, setCategories |
| games.queries.js | createRound, getCurrentRound, getRoundsByRoom, submitAnswer, getAnswersForRound, getDetailedAnswersForRound, submitVote, removeVote, getVoteCountsForAnswer, uploadImage, getImageData, getDefaultCategories, saveMessage, getChatHistory, upsertLeaderboard |
| admin.queries.js | listUsers, listRooms, getChatMessages, deleteMessage, createAnnouncement, getAnnouncements, getReports, reviewReport, getLogs, logAction |
| contact.queries.js | create, list, markAsRead, getUnreadCount |
| kvkk.queries.js | acceptPrivacy, getStatus, requestDeletion, cancelDeletion, getUserData, getScheduledDeletions, deleteUser |

## Client State Management

`Store` modülü (client/js/utils/store.js) — reactive in-memory state:

```javascript
// State alanları
{
  user: null,           // Giriş yapan kullanıcı objesi
  token: null,          // JWT access token
  refreshToken: null,   // Refresh token
  currentRoom: null,    // Aktif oda kodu
  currentRound: null,   // Aktif tur bilgisi
  players: [],          // Oda oyuncuları
  messages: [],         // Chat mesajları
  onlineCount: 0,       // Online kullanıcı sayısı
  rooms: [],            // Lobby'deki oda listesi
  scores: [],           // Tur skorları
  gameState: 'idle',    // idle | waiting | playing | voting | scoring | finished
  votes: {},            // Oylama verileri
  answerRevealMode: 'direct', // direct | button
}

// Kullanım: Store.get('user'), Store.set('gameState', 'playing')
// Subscription: Store.on('gameState', (newVal, oldVal) => {...})
// Persist: token + user localStorage'da saklanır
```

## Önemli Sorgu Kalıpları

1. **Parameterized**: Tüm sorgular `$1, $2` ile — SQL injection koruması
2. **UPSERT**: `INSERT ... ON CONFLICT DO UPDATE` (leaderboard, room_players)
3. **Interval**: `make_interval(mins => $1)` — güvenli interval hesaplama
4. **Transaction**: `setCategories()` DELETE + bulk INSERT bir transaction'da
5. **Soft Delete**: `chat_messages.is_deleted` flag
6. **Slow Query Log**: >1000ms sorgular otomatik loglanır
7. **Partial Index**: `idx_users_email` WHERE email IS NOT NULL, `idx_user_deletions_scheduled` WHERE completed_at IS NULL
