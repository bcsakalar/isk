# İş Mantığı — Katman İsim Şehir

> Son güncelleme: 2026-03-30

## Proje Amacı
Türkçe "İsim Şehir" kelime oyununun modern, çok oyunculu, gerçek zamanlı versiyonu. Oyuncular odalara katılıp belirli bir harfle başlayan kelimeler yazarak puan toplar. Oylama tabanlı skorlama sistemi kullanır.

## Kullanıcı Rolleri

| Rol | Yetkiler |
|-----|----------|
| `player` | Varsayılan. Oda oluştur/katıl, oyna, sohbet, XP/istatistik kazan |
| `guest` | Misafir giriş. Oda oluştur/katıl, oyna, sohbet. XP/istatistik/leaderboard **hariç** |
| `moderator` | Player + rapor inceleme (DB'de tanımlı, özel middleware limitli) |
| `admin` | Herşey. Kullanıcı ban/unban, oda kapatma, duyuru, log görüntüleme, iletişim mesajları |

### Misafir Kullanıcı Sistemi
- `POST /api/auth/guest` ile kayıt olmadan misafir girişi yapılır
- Misafir kullanıcılar `is_guest = TRUE`, `guest_expires_at` ile süreli hesap alır
- Oyun sonunda XP, istatistik ve leaderboard güncellemesi **yapılmaz**
- `guestCleanup` cron job'ı süresi dolan misafir hesaplarını her 30 dakikada temizler

## Oyun Akışı (Tam Lifecycle)

### 1. Oda Oluşturma
- Sahip 6 karakterlik benzersiz kod ile oda oluşturur (max 10 deneme)
- Ayarlar: gameMode, maxPlayers(2-15), totalRounds(1-20), timePerRound(30-300s), isPrivate, answerRevealMode(direct/button), votingTimer(0=süresiz veya 10-300s), enabledLetters
- Özel odalarda şifre bcrypt ile hashlenip saklanır
- Sahip otomatik ilk oyuncu olarak eklenir
- Status: `waiting`
- Kategori seçimi: Varsayılan 5 kategori (İsim, Şehir, Hayvan, Bitki, Ülke) + sahip değiştirebilir

### 2. Katılım ve Bekleme
- Oyuncular oda kodu ve şifre (varsa) ile katılır
- Davet linki ile direkt katılım mümkün
- Her oyuncu "Hazır" butonuna basar
- Minimum 2 oyuncu, tümü hazır olmalı
- Sadece oda sahibi "Başlat" butonuna basabilir
- Oda bekleme ekranında: kategori düzenleme, harf seçimi, oda ayarları

### 3. Oyunun Başlaması
- Status: `playing`
- İlk tur başlar

### 4. Her Tur
```
a) HARF SEÇİMİ
   - enabled_letters listesinden daha önce kullanılmayan harfler arasından rastgele
   - Varsayılan: 29 Türkçe harf (A-Z, Ç, Ğ, I, İ, Ö, Ş, Ü)

b) CEVAP SÜRESİ (varsayılan 90s)
   - Her saniye countdown yayınlanır (game:round_timer)
   - Oyuncular her kategori için seçilen harfle başlayan kelime yazar
   - "DUR!" butonuna herhangi bir oyuncu basabilir
   - Zamanlayıcı biterse otomatik durur

c) SKORLAMA (anında hesaplanır)
   - Boş cevap = 0 puan
   - Yanlış harfle başlayan = 0 puan (is_valid = false)
   - Doğru + benzersiz = 10 puan (base_score)
   - Doğru + tekrar eden = 5 puan (is_duplicate = true)

d) OYLAMA FAZI
   - answer_reveal_mode = 'direct': Cevaplar anında görünür
   - answer_reveal_mode = 'button': Oyuncular "Göster" butonuna basar
   - voting_timer = 0: Süresiz oylama (sahip "Bitir" ile sonlandırır)
   - voting_timer = 10-300: Süreli oylama + countdown
   - Oyuncular her cevaba pozitif veya negatif oy verir
   - Kanıt resmi yüklenebilir (base64, max boyut)
   - Sahip "Bitir" ile oylama fazını sonlandırabilir
   - Oylama sonuçları vote_score olarak kaydedilir
```

### 5. Oyun Sonu
- Son tur bittiğinde
- Status: `finished`
- XP dağıtımı (sadece kayıtlı kullanıcılar, misafirler hariç): skor + 50 (kazanan) veya skor + 10 (kaybeden)
- Kullanıcı istatistikleri güncellenir (xp, level, wins, total_games)
- Leaderboard upsert (haftalık + aylık)
- Final sıralama yayınlanır
- "ODAYA DÖN" butonu: oda sıfırlanır, skorlar resetlenir, oyuncular hazır durumuna döner
- "LOBİYE DÖN" butonu: oda terk edilir

## Skorlama Detayı

### Temel Puanlama
```
Boş cevap              → 0 puan (base_score = 0)
Yanlış harf            → 0 puan (is_valid = false)
Doğru + Benzersiz      → 10 puan (base_score = 10)
Doğru + Tekrar eden    → 5 puan (base_score = 5, is_duplicate = true)
```

### Oylama Puanı
- Her cevaba yapılan oylar `vote_score` olarak `player_answers` tablosuna kaydedilir
- Toplam puan: `base_score + vote_score`
- İtiraz edilen cevaplar: `is_challenged = TRUE`, etkisi oylama sonuçlarına yansır

## Oylama Sistemi

### Akış
```
Tur sonu → Oylama fazı başlar
1. Cevaplar gösterilir (answer_reveal_mode'a göre anında veya butonla)
2. Oyuncular her cevaba pozitif (+) veya negatif (-) oy verir
3. Her oyuncu bir cevaba sadece 1 oy verebilir (toggle: değiştir veya kaldır)
4. Kanıt resmi yüklenebilir (answer_images tablosu)
5. Oy sayıları gerçek zamanlı yayınlanır (game:vote_update)
```

### Oylama Süresi
```
voting_timer = 0   → Süresiz. Sahip "Bitir" tıklayana kadar devam eder.
voting_timer > 0   → Süreli (10-300 saniye). Süre bitince veya sahip "Bitir" tıklayınca biter.
```

### Sonuçlandırma
```
1. Otomatik (timer bitmesi) veya manuel (sahip "Bitir" tıklar)
2. Oy puanları hesaplanır (vote_score)
3. room_players.total_score güncellenir
4. 'game:voting_finished' event yayınlanır
5. Sonuç ekranı gösterilir
```

## Oyun Modları

| Mod | Özellik |
|-----|---------|
| `classic` | Standart oyun |
| `lightning` | Hızlı turlar |
| `duel` | 1v1 oyun |
| `tournament` | Turnuva bracket içinde (DB tabloları var, implementasyon minimal) |

## Oda Sahipliği ve Yaşam Döngüsü
- Sahip ayrılırsa: ilk aktif oyuncuya devredilir (`transferOwnership`)
- Sahip yoksa ve oda boşsa: status = `abandoned`
- 30 dakika inaktif oda otomatik `abandoned` yapılır (roomCleanup cron)
- Sahiplik devri butonu: Oyun bekleme ekranında sahip başka bir oyuncuya devredebilir
- Socket reconnect: Bağlantı koptuğunda otomatik oda rejoin (room:rejoin)

## Room Status Durum Makinesi
```
waiting → playing → finished
    ↓                  ↓
  paused           abandoned
    ↑__________________↓
```

## Token Stratejisi
- JWT Access Token: 15 dakika ömür
- Refresh Token: 7 gün ömür, SHA-256 hash olarak DB'de saklanır
- Her refresh işleminde token çifti yenilenir (one-time rotation)
- Logout: refresh token silinir

### Hesap Kilitleme (Account Lockout)
- 5 başarısız giriş denemesi → hesap 15 dakika kilitlenir
- `failed_login_attempts` ve `locked_until` sütunları ile takip
- Başarılı girişte sayaç sıfırlanır

## WebSocket Event Haritası

### Lobby
```
CONNECT → socketAuth → socketSanitizer → socketRateLimit
        → lobby room'a katıl → lobby:online_count yayınla → lobby:rooms gönder
lobby:refresh                 → güncel oda listesi gönder
DISCONNECT                    → online_count güncelle
```

### Room
```
room:rejoin (auto-reconnect)  → oda room'a yeniden katıl
room:join { code, password }  → room:joined + room:player_joined (broadcast)
room:ready                    → room:players_updated (broadcast)
room:leave                    → room:player_left (broadcast)
room:settings_updated         → oda ayarları değişti (broadcast)
room:categories_updated       → kategoriler değişti (broadcast)
room:players_updated          → oyuncu listesi güncellendi (broadcast)
room:transfer_ownership       → room:owner_changed (broadcast)
room:reset_for_new_game       → oda sıfırlama (skor reset, ready reset)
```

### Game
```
game:start (sadece owner)     → game:started { round, categories, players }
game:round_timer              → her 1s countdown yayınla
game:submit_answers { ans }   → game:answers_submitted + game:player_submitted (broadcast)
game:round_finished           → tur bitti, oylama fazına geç
game:vote { answerId, type }  → game:vote_update { voteCounts, voterName, voteType }
game:remove_vote { answerId } → game:vote_update (oy kaldırıldı)
game:upload_image { data }    → game:image_uploaded (kanıt resmi broadcast)
game:voting_timer             → oylama countdown yayınla
game:end_voting (owner)       → game:voting_finished { results, updatedScores }
game:round_results            → tur detaylı sonuçları
game:game_finished            → oyun bitti, final skorlar
game:error                    → hata mesajı (client'a)
```

### Chat
```
chat:room { message }         → chat:room_message (broadcast)
chat:reaction { emoji }       → chat:reaction (broadcast — 8 emoji desteklenir)
chat:history                  → mesaj geçmişi gönder
```

### Admin
```
admin:announce { title, content, target }  → announcement broadcast
admin:kick_user { userId, roomId }         → kullanıcı odadan atılır
admin:close_room { roomId }                → tüm oyuncular atılır, oda kapatılır
```

## Rate Limiting

| Limiter | Limit | Pencere | Hedef |
|---------|-------|---------|-------|
| generalLimiter | 100 istek | env'den (varsayılan 1 dk) | IP bazlı |
| authLimiter | 10 istek | 1 dk | IP bazlı |
| registerLimiter | 5 istek | 1 saat | IP bazlı |
| apiLimiter | 60 istek | 1 dk | user.id veya IP bazlı |
| contactLimiter | 3 istek | 1 saat | IP bazlı |
| socketRateLimit | 5 mesaj | 1 sn | user.id bazlı |

## Cron Jobs

| Job | Zamanlama | İşlem |
|-----|-----------|-------|
| roomCleanup | Her 5 dk | >30 dk inaktif odaları abandoned yap |
| sessionCleanup | Her saat | Süresi dolmuş refresh token'ları sil |
| chatPurge | Her gün 03:00 | >7 gün eski mesajları sil |
| leaderboardReset | Her Pazar 00:00 | Haftalık sıralama snapshot al |
| accountDeletion | Her gün 03:30 | Zamanlanmış hesap silme taleplerini işle |
| guestCleanup | Her 30 dk | Süresi dolan misafir hesaplarını sil |

## Service Sorumlulukları

| Service | Ana Fonksiyonlar |
|---------|-----------------|
| auth.service | register, guestLogin, login, refresh, logout |
| game.service | startGame, startNextRound, submitAnswers, endRound, submitVote, removeVote, uploadImage, startVotingPhase, endVotingPhase, getRecoveryState |
| room.service | createRoom, joinRoom, leaveRoom, getRoom, getRoomByCode, listActiveRooms, listPublicRooms, updateRoomSettings, setRoomCategories, addRoomCategory, removeRoomCategory |
| scoring.service | calculateBaseScore, calculateScores, applyScoresToPlayers, getGameResults |
| answer.service | validateAnswer, checkDuplicates, getDetailedAnswer |
| cleanup.service | cleanInactiveRooms, cleanExpiredSessions, purgeOldChats |
| contact.service | submitContactMessage (validasyon: name 2-100, email regex, subject 2-200, message 10-2000) |
| kvkk.service | acceptPrivacy, getStatus, requestDeletion, cancelDeletion, exportUserData, processScheduledDeletions |

## Admin İşlemleri
- Kullanıcı listele, ban/unban, rol değiştir
- Oda listele, oda kapat (tüm oyuncuları at)
- Duyuru gönder (hedef: all/lobby/room)
- Chat mesajı sil, rapor incele/kapat
- İletişim mesajlarını görüntüle, okundu işaretle, okunmamış sayısı
- Tüm işlemler `admin_logs` tablosuna kaydedilir

## KVKK Uyumu
- Gizlilik politikası onayı: `POST /api/kvkk/accept-privacy`
- Onay durumu sorgulama: `GET /api/kvkk/privacy-status`
- Kişisel veri dışa aktarma: `GET /api/kvkk/export` (JSON formatında tüm kullanıcı verileri)
- Hesap silme talebi: `POST /api/kvkk/request-deletion` (30 gün sonra otomatik silme)
- Silme talebi iptal: `POST /api/kvkk/cancel-deletion`
- `privacy_consents` tablosu: her onay kaydı (IP, user-agent, versiyon)
- `user_deletions` tablosu: silme kuyruğu (scheduled_for, completed_at)

## İletişim Formu
- `POST /api/contact` — Herkese açık (auth gerekmez)
- `contactLimiter`: 3 mesaj / saat / IP (bot koruması)
- Validasyon: name (2-100), email (RFC), subject (2-200), message (10-2000)
- Admin panelinde: mesaj listesi, okunmamış badge, okundu işaretleme

## Hata Hiyerarşisi

```
AppError (base) — isOperational: true
├─ BadRequestError (400)     — Geçersiz input
├─ UnauthorizedError (401)   — JWT geçersiz, ban, hesap kilitli
├─ ForbiddenError (403)      — Yetki yok
├─ NotFoundError (404)       — Kaynak bulunamadı
├─ ConflictError (409)       — Benzersizlik çakışması
└─ RateLimitError (429)      — Rate limit aşıldı
```

Operasyonel olmayan hatalar (isOperational: false) HTTP 500 döner ve loglara yazılır. Stack trace sadece development'ta response'a eklenir.

## Input Validasyon Kuralları

```
Username:        /^[a-zA-Z0-9_]+$/, uzunluk 3-20
Password:        minimum 8 karakter
Email:           standart RFC formatı (misafirler için opsiyonel)
Room name:       2-40 karakter
Max players:     2-15
Rounds:          1-20
Time/round:      30-300 saniye
Voting timer:    0 (süresiz) veya 10-300 saniye
Answer:          max 100 karakter, tur harfi ile başlamalı
Chat:            1-500 karakter, DOMPurify ile sanitize
Answer ID:       integer > 0
Room ID:         integer > 0
Contact name:    2-100 karakter
Contact email:   RFC email formatı
Contact subject: 2-200 karakter
Contact message: 10-2000 karakter
```
