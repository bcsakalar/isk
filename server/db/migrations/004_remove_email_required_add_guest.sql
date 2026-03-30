-- Migration 004: Email zorunluluğunu kaldır, misafir oyuncu desteği ekle
-- Tarih: 2026-03-26

-- 1) Email sütununu opsiyonel yap
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- 2) Mevcut UNIQUE index'i kaldır, partial unique index ile değiştir
--    (NULL email'ler çakışma yaratmasın)
DROP INDEX IF EXISTS idx_users_email;
CREATE UNIQUE INDEX idx_users_email ON users (email) WHERE email IS NOT NULL;

-- 3) Misafir oyuncu flag'i
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE;

-- 4) Misafir hesap son kullanma tarihi (cleanup job için)
ALTER TABLE users ADD COLUMN IF NOT EXISTS guest_expires_at TIMESTAMPTZ;

-- 5) Cleanup job performansı için partial index
CREATE INDEX IF NOT EXISTS idx_users_guest_cleanup
  ON users (guest_expires_at)
  WHERE is_guest = TRUE;
