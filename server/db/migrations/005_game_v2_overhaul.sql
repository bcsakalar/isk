-- ==========================================
-- Migration 005: Game V2 Overhaul
-- Oylama sistemi, resim kanıtı, oda ayarları
-- ==========================================

BEGIN;

-- ==========================================
-- 1. ROOMS — Yeni sütunlar
-- ==========================================

-- Cevap gösterme modu: 'direct' (anında) veya 'button' (buton ile)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS answer_reveal_mode TEXT NOT NULL DEFAULT 'direct'
  CHECK (answer_reveal_mode IN ('direct', 'button'));

-- Aktif harfler (virgülle ayrılmış)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS enabled_letters TEXT NOT NULL
  DEFAULT 'A,B,C,Ç,D,E,F,G,Ğ,H,I,İ,J,K,L,M,N,O,Ö,P,R,S,Ş,T,U,Ü,V,Y,Z';

-- Oylama süresi (saniye)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS voting_timer INTEGER NOT NULL DEFAULT 60
  CHECK (voting_timer BETWEEN 30 AND 120);

-- max_players constraint güncelle: 2-15
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_max_players_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_max_players_check CHECK (max_players BETWEEN 2 AND 15);

-- current_layer sütununu kaldır (layer sistemi kaldırıldı)
ALTER TABLE rooms DROP COLUMN IF EXISTS current_layer;

-- ==========================================
-- 2. ROOM PLAYERS — combo_streak kaldır
-- ==========================================

ALTER TABLE room_players DROP COLUMN IF EXISTS combo_streak;

-- ==========================================
-- 3. GAME ROUNDS — Oylama sütunları ekle, eski sütunlar kaldır
-- ==========================================

-- Eski sütunları kaldır
ALTER TABLE game_rounds DROP COLUMN IF EXISTS is_lightning;
ALTER TABLE game_rounds DROP COLUMN IF EXISTS is_ghost_letter;
ALTER TABLE game_rounds DROP COLUMN IF EXISTS ghost_letter;
ALTER TABLE game_rounds DROP COLUMN IF EXISTS layer_level;
ALTER TABLE game_rounds DROP COLUMN IF EXISTS stopped_by;

-- Oylama zamanları ekle
ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS voting_started_at TIMESTAMPTZ;
ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS voting_finished_at TIMESTAMPTZ;

-- ==========================================
-- 4. PLAYER ANSWERS — Oylama puanı, duplicate flag
-- ==========================================

-- Oylama puanı
ALTER TABLE player_answers ADD COLUMN IF NOT EXISTS vote_score INTEGER NOT NULL DEFAULT 0;

-- Duplicate cevap flag
ALTER TABLE player_answers ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN NOT NULL DEFAULT FALSE;

-- bonus_score kaldır (combo sistemi yok)
ALTER TABLE player_answers DROP COLUMN IF EXISTS bonus_score;

-- ==========================================
-- 5. YENİ TABLO: answer_votes — Oylama kayıtları
-- ==========================================

CREATE TABLE IF NOT EXISTS answer_votes (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    answer_id       BIGINT NOT NULL REFERENCES player_answers(id) ON DELETE CASCADE,
    voter_id        BIGINT NOT NULL REFERENCES room_players(id) ON DELETE CASCADE,
    vote_type       TEXT NOT NULL CHECK (vote_type IN ('positive', 'negative')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (answer_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_answer ON answer_votes (answer_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter ON answer_votes (voter_id);

-- ==========================================
-- 6. YENİ TABLO: answer_images — Kanıt resimleri
-- ==========================================

CREATE TABLE IF NOT EXISTS answer_images (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    answer_id       BIGINT NOT NULL REFERENCES player_answers(id) ON DELETE CASCADE,
    uploaded_by     BIGINT NOT NULL REFERENCES room_players(id) ON DELETE CASCADE,
    image_data      TEXT NOT NULL,
    mime_type       TEXT NOT NULL DEFAULT 'image/jpeg',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_images_answer ON answer_images (answer_id);

COMMIT;
