-- Kategoriler (Temel Oyun Kategorileri)
INSERT INTO categories (name, slug, description, is_default) VALUES
  -- Varsayılan kategoriler
  ('İsim', 'isim', 'Kişi isimleri (erkek veya kadın)', true),
  ('Şehir', 'sehir', 'Dünya üzerindeki şehirler', true),
  ('Hayvan', 'hayvan', 'Hayvan türleri', true),
  ('Bitki', 'bitki', 'Bitki ve çiçek türleri', true),
  ('Ülke', 'ulke', 'Dünya ülkeleri', true),
  -- Coğrafya
  ('Nehir', 'nehir', 'Nehir ve akarsular', false),
  ('Dağ', 'dag', 'Dağ isimleri', false),
  ('Başkent', 'baskent', 'Ülkelerin başkentleri', false),
  ('Ada', 'ada', 'Dünya üzerindeki ada isimleri', false),
  ('Göl', 'gol', 'Göl isimleri', false),
  -- Yeme-İçme
  ('Meyve', 'meyve', 'Meyve türleri', false),
  ('Sebze', 'sebze', 'Sebze türleri', false),
  ('Yiyecek', 'yiyecek', 'Yemek ve yiyecek isimleri', false),
  ('İçecek', 'icecek', 'İçecek türleri', false),
  ('Baharat', 'baharat', 'Baharat ve ot türleri', false),
  ('Tatlı', 'tatli', 'Tatlı ve pasta çeşitleri', false),
  -- Eğlence & Kültür
  ('Film', 'film', 'Film isimleri', false),
  ('Dizi', 'dizi', 'Televizyon dizi isimleri', false),
  ('Şarkı', 'sarki', 'Şarkı isimleri', false),
  ('Kitap', 'kitap', 'Kitap isimleri', false),
  ('Çizgi Film', 'cizgi_film', 'Çizgi film ve anime isimleri', false),
  ('Oyun', 'oyun', 'Video oyunu ve masa oyunu isimleri', false),
  -- İnsanlar
  ('Meslek', 'meslek', 'Meslekler ve iş kolları', false),
  ('Ünlü', 'unlu', 'Ünlü kişiler (sanatçı, sporcu vb.)', false),
  ('Tarihi Kişi', 'tarihi_kisi', 'Tarihte iz bırakan kişiler', false),
  ('Süper Kahraman', 'super_kahraman', 'Çizgi roman ve film süper kahramanları', false),
  ('Mitoloji', 'mitoloji', 'Mitolojik tanrılar, yaratıklar ve kahramanlar', false),
  -- Spor
  ('Spor', 'spor', 'Spor dalları', false),
  ('Takım', 'takim', 'Spor kulüpleri ve takım isimleri', false),
  -- Günlük Hayat
  ('Eşya', 'esya', 'Günlük kullanım eşyaları', false),
  ('Giysi', 'giysi', 'Kıyafet ve giyim eşyaları', false),
  ('Renk', 'renk', 'Renkler ve tonları', false),
  ('Müzik Aleti', 'muzik_aleti', 'Müzik enstrümanları', false),
  -- Markalar & Teknoloji
  ('Marka', 'marka', 'Dünya çapında bilinen markalar', false),
  ('Araba Markası', 'araba', 'Otomobil markaları', false),
  ('Teknoloji', 'teknoloji', 'Teknoloji terimleri, yazılım ve donanım', false),
  -- Yaratıcı & Eğlenceli
  ('İngilizce Kelime', 'ingilizce_kelime', 'İngilizce bir kelime yaz ve Türkçe anlamını bilmelisin', false),
  ('Yatakta Söylenmeyecek Söz', 'yatakta_soylenmeyecek', 'Yatakta kesinlikle söylenmemesi gereken cümleler', false),
  ('Savaşta Son Söz', 'savasta_son_soz', 'Savaş meydanında söylenebilecek son sözler', false),
  ('Bir Filmin Konusu Olabilecek Cümle', 'film_konusu', 'Başlı başına bir film senaryosu olabilecek tek cümle', false),
  ('Dünyada Olmayan Şehir', 'hayali_sehir', 'Uydurma ama kulağa gerçekçi gelen şehir isimleri', false),
  ('Annene Açıklayamayacağın Meslek', 'aciklanamayanmeslek', 'Annene anlatması zor olan iş tanımları', false),
  ('İlk Buluşmada Sorulmayacak Soru', 'ilk_bulusma', 'İlk buluşmada kesinlikle sorulmaması gereken sorular', false),
  ('Atasözü / Deyim', 'atasozu', 'Türkçe atasözleri ve deyimler', false),
  ('Tarihi Olay', 'tarihi_olay', 'Tarihte yaşanmış önemli olaylar', false),
  ('Bir Şarkıdan Dize', 'sarki_dize', 'Bilinen bir şarkıdan bir satır yaz', false)
ON CONFLICT (slug) DO NOTHING;

-- Başarılar (Achievements)
INSERT INTO achievements (name, slug, description, icon, condition) VALUES
  ('İlk Zafer', 'first_win', 'İlk oyununuzu kazanın', '🏆', '{"type":"wins","count":1}'),
  ('Seri Katil', 'win_streak_5', '5 oyun üst üste kazanın', '🔥', '{"type":"win_streak","count":5}'),
  ('Kelime Ustası', 'unique_100', '100 benzersiz cevap verin', '📝', '{"type":"unique_answers","count":100}'),
  ('Hız Şeytanı', 'speed_demon', 'Bir turu 10 saniyede tamamlayın', '⚡', '{"type":"speed","seconds":10}'),
  ('Sosyal Kelebek', 'social_50', '50 farklı oyuncuyla oynayın', '🦋', '{"type":"unique_opponents","count":50}'),
  ('Veterano', 'games_100', '100 oyun tamamlayın', '🎖️', '{"type":"games","count":100}'),
  ('Tam Skor', 'perfect_round', 'Bir turda tüm kategorilerde benzersiz cevap verin', '💎', '{"type":"perfect_round"}'),
  ('Night Owl', 'night_owl', 'Gece 02:00-05:00 arası oyun kazanın', '🦉', '{"type":"time_win","start":"02:00","end":"05:00"}')
ON CONFLICT (slug) DO NOTHING;
