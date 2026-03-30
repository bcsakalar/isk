-- ============================================================
-- 002: İtiraz (Challenge) Sistemi
-- ============================================================

-- player_answers tablosuna is_challenged kolonu ekle
ALTER TABLE player_answers ADD COLUMN IF NOT EXISTS is_challenged BOOLEAN NOT NULL DEFAULT FALSE;

-- İtiraz tablosu — hangi oyuncu hangi cevaba itiraz etti
CREATE TABLE IF NOT EXISTS answer_challenges (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    answer_id       BIGINT NOT NULL REFERENCES player_answers(id) ON DELETE CASCADE,
    challenger_id   BIGINT NOT NULL REFERENCES room_players(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (answer_id, challenger_id)
);

CREATE INDEX IF NOT EXISTS idx_challenges_answer ON answer_challenges (answer_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON answer_challenges (challenger_id);
