-- player_answers tablosuna is_revealed kolonu ekle
-- Oylama sırasında oyuncunun cevabını açtığını kalıcı olarak izler
ALTER TABLE player_answers ADD COLUMN IF NOT EXISTS is_revealed BOOLEAN NOT NULL DEFAULT FALSE;
