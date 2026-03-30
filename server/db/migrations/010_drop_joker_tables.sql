-- Migration 010: Joker tablolarını kaldır
-- Joker sistemi hiçbir zaman tam olarak bağlanmadı (socket handler yok, efektler yok).
-- Orphaned tabloları temizliyoruz.

DROP TABLE IF EXISTS player_jokers CASCADE;
DROP TABLE IF EXISTS joker_types CASCADE;
