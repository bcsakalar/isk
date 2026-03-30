-- Kullanıcıların eklediği saçma/geçersiz custom kategorileri temizle
-- Önce tüm referansları sil, sonra kategorileri

DELETE FROM player_answers
WHERE category_id IN (
  SELECT id FROM categories WHERE is_default = FALSE
);

DELETE FROM room_categories
WHERE category_id IN (
  SELECT id FROM categories WHERE is_default = FALSE
);

DELETE FROM categories WHERE is_default = FALSE;
