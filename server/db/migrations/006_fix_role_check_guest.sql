-- Migration 006: Role check constraint'e 'guest' ekle
-- Tarih: 2026-03-26

-- Mevcut check constraint'i kaldır
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 'guest' dahil yeni constraint ekle
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('player', 'moderator', 'admin', 'guest'));
