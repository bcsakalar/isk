-- Migration 007: Oylama süresi constraint'ini genişlet (0 = süresiz, max 300)
-- Tarih: 2026-03-28

-- Mevcut constraint'i kaldır
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_voting_timer_check;

-- Yeni constraint: 0 (süresiz) veya 10-300 arası
ALTER TABLE rooms ADD CONSTRAINT rooms_voting_timer_check
  CHECK (voting_timer = 0 OR voting_timer BETWEEN 10 AND 300);
