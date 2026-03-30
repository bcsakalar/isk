-- ==========================================
-- Migration 003: Schema-Seed Uyumsuzluk Düzeltmeleri
-- categories.description ekleme
-- achievements: criteria_type/criteria_value → condition JSONB
-- ==========================================

BEGIN;

-- 1. categories tablosuna description sütunu ekle
ALTER TABLE categories ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. achievements tablosundaki criteria_type ve criteria_value sütunlarını kaldır,
--    yerine esnek JSONB condition sütunu ekle
ALTER TABLE achievements DROP COLUMN IF EXISTS criteria_type;
ALTER TABLE achievements DROP COLUMN IF EXISTS criteria_value;
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS condition JSONB;

COMMIT;
