-- ==========================================
-- İsim Şehir Katman — PostgreSQL Şeması
-- Migration 001: Initial Schema
-- ==========================================

BEGIN;

-- ==========================================
-- 1. KULLANICILAR
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username        TEXT NOT NULL UNIQUE,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    avatar_url      TEXT,
    role            TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'moderator', 'admin')),
    xp              INTEGER NOT NULL DEFAULT 0,
    level           INTEGER NOT NULL DEFAULT 1,
    total_wins      INTEGER NOT NULL DEFAULT 0,
    total_games     INTEGER NOT NULL DEFAULT 0,
    is_banned       BOOLEAN NOT NULL DEFAULT FALSE,
    ban_reason      TEXT,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- ==========================================
-- 2. OTURUMLAR (Refresh Token)
-- ==========================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token   TEXT NOT NULL UNIQUE,
    ip_address      INET,
    user_agent      TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions (expires_at);

-- ==========================================
-- 3. KATEGORİLER
-- ==========================================
CREATE TABLE IF NOT EXISTS categories (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    slug            TEXT NOT NULL UNIQUE,
    icon            TEXT,
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- 4. ODALAR
-- ==========================================
CREATE TABLE IF NOT EXISTS rooms (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    owner_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'waiting'
                    CHECK (status IN ('waiting', 'playing', 'paused', 'finished', 'abandoned')),
    game_mode       TEXT NOT NULL DEFAULT 'classic'
                    CHECK (game_mode IN ('classic', 'lightning', 'duel', 'tournament', 'layered')),
    max_players     INTEGER NOT NULL DEFAULT 8 CHECK (max_players BETWEEN 2 AND 16),
    current_round   INTEGER NOT NULL DEFAULT 0,
    total_rounds    INTEGER NOT NULL DEFAULT 10,
    time_per_round  INTEGER NOT NULL DEFAULT 90,
    is_private      BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash   TEXT,
    current_layer   INTEGER NOT NULL DEFAULT 1 CHECK (current_layer BETWEEN 1 AND 3),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    last_activity   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms (status);
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms (code);
CREATE INDEX IF NOT EXISTS idx_rooms_owner ON rooms (owner_id);
CREATE INDEX IF NOT EXISTS idx_rooms_last_activity ON rooms (last_activity);

-- ==========================================
-- 5. ODA KATEGORİLERİ
-- ==========================================
CREATE TABLE IF NOT EXISTS room_categories (
    room_id         BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    category_id     BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (room_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_room_categories_room ON room_categories (room_id);

-- ==========================================
-- 6. ODA OYUNCULARI
-- ==========================================
CREATE TABLE IF NOT EXISTS room_players (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id         BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_score     INTEGER NOT NULL DEFAULT 0,
    combo_streak    INTEGER NOT NULL DEFAULT 0,
    is_ready        BOOLEAN NOT NULL DEFAULT FALSE,
    is_eliminated   BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at         TIMESTAMPTZ,
    UNIQUE (room_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_room_players_room ON room_players (room_id);
CREATE INDEX IF NOT EXISTS idx_room_players_user ON room_players (user_id);

-- ==========================================
-- 7. OYUN TURLARI
-- ==========================================
CREATE TABLE IF NOT EXISTS game_rounds (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id         BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    round_number    INTEGER NOT NULL,
    letter          TEXT NOT NULL CHECK (LENGTH(letter) = 1),
    is_lightning    BOOLEAN NOT NULL DEFAULT FALSE,
    is_ghost_letter BOOLEAN NOT NULL DEFAULT FALSE,
    ghost_letter    TEXT CHECK (ghost_letter IS NULL OR LENGTH(ghost_letter) = 1),
    layer_level     INTEGER NOT NULL DEFAULT 1,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    stopped_by      BIGINT REFERENCES users(id),
    UNIQUE (room_id, round_number)
);
CREATE INDEX IF NOT EXISTS idx_rounds_room ON game_rounds (room_id);

-- ==========================================
-- 8. OYUNCU CEVAPLARI
-- ==========================================
CREATE TABLE IF NOT EXISTS player_answers (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    round_id        BIGINT NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
    player_id       BIGINT NOT NULL REFERENCES room_players(id) ON DELETE CASCADE,
    category_id     BIGINT NOT NULL REFERENCES categories(id),
    answer          TEXT NOT NULL DEFAULT '',
    is_valid        BOOLEAN,
    is_unique       BOOLEAN,
    base_score      INTEGER NOT NULL DEFAULT 0,
    bonus_score     INTEGER NOT NULL DEFAULT 0,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_answers_round ON player_answers (round_id);
CREATE INDEX IF NOT EXISTS idx_answers_player ON player_answers (player_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_answers_unique ON player_answers (round_id, player_id, category_id);

-- ==========================================
-- 9. JOKER KARTLARI (Tanımları)
-- ==========================================
CREATE TABLE IF NOT EXISTS joker_types (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL,
    icon            TEXT,
    unlock_level    INTEGER NOT NULL DEFAULT 1,
    max_per_game    INTEGER NOT NULL DEFAULT 1,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- ==========================================
-- 10. OYUNCU JOKERLERİ
-- ==========================================
CREATE TABLE IF NOT EXISTS player_jokers (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_player_id  BIGINT NOT NULL REFERENCES room_players(id) ON DELETE CASCADE,
    joker_type_id   BIGINT NOT NULL REFERENCES joker_types(id),
    used_in_round   BIGINT REFERENCES game_rounds(id),
    is_used         BOOLEAN NOT NULL DEFAULT FALSE,
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    used_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_player_jokers_player ON player_jokers (room_player_id);

-- ==========================================
-- 11. SOHBET MESAJLARI
-- ==========================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id         BIGINT REFERENCES rooms(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message         TEXT NOT NULL CHECK (LENGTH(message) BETWEEN 1 AND 500),
    is_system       BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_room ON chat_messages (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_messages (user_id);

-- ==========================================
-- 12. BAŞARIMLAR (Tanımları)
-- ==========================================
CREATE TABLE IF NOT EXISTS achievements (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL,
    icon            TEXT,
    xp_reward       INTEGER NOT NULL DEFAULT 0,
    criteria_type   TEXT NOT NULL,
    criteria_value  INTEGER NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- ==========================================
-- 13. KULLANICI BAŞARIMLARI
-- ==========================================
CREATE TABLE IF NOT EXISTS user_achievements (
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id  BIGINT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements (user_id);

-- ==========================================
-- 14. LİDERLİK TABLOSU
-- ==========================================
CREATE TABLE IF NOT EXISTS leaderboard (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    season          TEXT NOT NULL,
    period_type     TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'season')),
    total_score     INTEGER NOT NULL DEFAULT 0,
    total_wins      INTEGER NOT NULL DEFAULT 0,
    games_played    INTEGER NOT NULL DEFAULT 0,
    rank            INTEGER,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, season, period_type)
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_season ON leaderboard (season, period_type, total_score DESC);

-- ==========================================
-- 15. ADMIN LOG
-- ==========================================
CREATE TABLE IF NOT EXISTS admin_logs (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admin_id        BIGINT NOT NULL REFERENCES users(id),
    action          TEXT NOT NULL,
    target_type     TEXT,
    target_id       BIGINT,
    details         JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs (created_at DESC);

-- ==========================================
-- 16. DUYURULAR
-- ==========================================
CREATE TABLE IF NOT EXISTS announcements (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admin_id        BIGINT NOT NULL REFERENCES users(id),
    title           TEXT NOT NULL,
    content         TEXT NOT NULL,
    target          TEXT NOT NULL DEFAULT 'all' CHECK (target IN ('all', 'lobby', 'room')),
    target_room_id  BIGINT REFERENCES rooms(id) ON DELETE SET NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- 17. TURNUVA
-- ==========================================
CREATE TABLE IF NOT EXISTS tournaments (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            TEXT NOT NULL,
    created_by      BIGINT NOT NULL REFERENCES users(id),
    status          TEXT NOT NULL DEFAULT 'registering'
                    CHECK (status IN ('registering', 'in_progress', 'finished', 'cancelled')),
    max_participants INTEGER NOT NULL DEFAULT 16,
    bracket_data    JSONB,
    winner_id       BIGINT REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ
);

-- ==========================================
-- 18. TURNUVA KATILIMCILARI
-- ==========================================
CREATE TABLE IF NOT EXISTS tournament_participants (
    tournament_id   BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seed            INTEGER,
    is_eliminated   BOOLEAN NOT NULL DEFAULT FALSE,
    final_rank      INTEGER,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tournament_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON tournament_participants (tournament_id);

-- ==========================================
-- 19. RAPOR/ŞİKAYET
-- ==========================================
CREATE TABLE IF NOT EXISTS reports (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporter_id     BIGINT NOT NULL REFERENCES users(id),
    reported_user_id BIGINT NOT NULL REFERENCES users(id),
    room_id         BIGINT REFERENCES rooms(id),
    reason          TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    admin_note      TEXT,
    reviewed_by     BIGINT REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status);

-- ==========================================
-- UPDATED_AT TRİGGER
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_leaderboard_updated_at ON leaderboard;
CREATE TRIGGER trg_leaderboard_updated_at
    BEFORE UPDATE ON leaderboard FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
