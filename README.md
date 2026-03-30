<div align="center">

# İsim Şehir Katman 🎮

**Gerçek zamanlı, çok oyunculu, retro tarzında Türkçe kelime oyunu**

[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?logo=socket.io)](https://socket.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## Nedir?

**İsim Şehir Katman**, hepimizin çocukluğundan bildiği "İsim Şehir" oyununu tarayıcıdan oynanan gerçek zamanlı bir multiplayer deneyimine dönüştürür. Retro piksel estetiğiyle tasarlanmış, kayıt ol ya da misafir olarak gir, oda kur, arkadaşlarını davet et ve oyna.

---

## Nasıl Oynanır?

### 1. Giriş Yap
- **Hesap oluştur** — kalıcı istatistikler, seviye sistemi, sıralama
- **Misafir giriş** — kayıt olmadan hemen oyna (istatistikler kaydedilmez)

### 2. Lobi
Lobide açık odaları gör, istediğine katıl ya da kendi odanı kur. Online oyuncu sayısı, oda detayları (kaç kişi, kaç tur, süre, kategori sayısı) hepsi bir bakışta görünür.

### 3. Oda Kurulumu
Oda sahibi şu ayarları yapabilir:

| Ayar | Seçenekler |
|------|-----------|
| **Tur Sayısı** | 1 – 15 |
| **Tur Süresi** | 30sn – 5dk |
| **Maks Oyuncu** | 2 – 15 |
| **Oylama Süresi** | Süreli (10–300sn) veya Süresiz |
| **Cevap Gösterimi** | Direkt veya Butonla (oyuncu kendi açar) |
| **Gizlilik** | Açık veya Şifreli |

**Kategoriler** — Varsayılan 5 kategori (İsim, Şehir, Hayvan, Bitki, Ülke) ile başlar. 40'tan fazla hazır kategori arasından seç veya kendi kategorini yaz:

<details>
<summary>Hazır Kategoriler</summary>

Nehir, Dağ, Başkent, Ada, Göl, Meyve, Sebze, Yiyecek, İçecek, Baharat, Tatlı, Film, Dizi, Şarkı, Kitap, Çizgi Film, Oyun, Meslek, Ünlü, Tarihi Kişi, Süper Kahraman, Mitoloji, Spor, Takım, Eşya, Giysi, Renk, Müzik Aleti, Marka, Araba Markası, Teknoloji, İngilizce Kelime, Atasözü / Deyim, Tarihi Olay, Bir Şarkıdan Dize, Bir Filmin Konusu Olabilecek Cümle, Dünyada Olmayan Şehir, Annene Açıklayamayacağın Meslek, İlk Buluşmada Sorulmayacak Soru, Yatakta Söylenmeyecek Söz, Savaşta Son Söz...

</details>

**Harfler** — Türk alfabesindeki 27 harften istediğini aç/kapat. Nadir harfleri (Ğ, Ö, Ş, Ü...) devre dışı bırakarak oyunu kolaylaştırabilirsin. En az 5 harf aktif olmalı.

### 4. Oyun
Herkes hazır olduğunda oda sahibi oyunu başlatır.

1. **Rastgele bir harf gelir** — ekranda büyük puntoda belirir
2. **Süre başlar** — her kategoriye o harfle başlayan bir cevap yaz
3. **Süre dolunca** (veya herkes gönderince) cevaplar kitlenir
4. **Oylama** başlar

### 5. Oylama
Tüm oyuncuların cevapları kategori kategori gösterilir.

- Her cevaba **✓ Doğru** veya **✗ Yanlış** oyu ver
- Aynı cevabı yazan oyuncular **"AYNI"** etiketiyle işaretlenir
- **Kanıt sistemi**: Şüpheli bir cevap için fotoğraf yükleyerek kanıt sun (cevap başına 3 görsel)
- "Butonla" modunda oyuncular cevaplarını kendileri açar — strateji unsuru ekler

### 6. Puanlama

| Durum | Puan |
|-------|------|
| Benzersiz cevap + olumlu oy | Her ✓ için **+10** |
| Tekrar cevap + olumlu oy | Her ✓ için **+5** |
| Olumsuz oy | Her ✗ için **-10** (minimum 0) |
| Boş veya yanlış harfle başlayan | **0** |

Turlar bittiğinde toplam skora göre kazanan belirlenir. Kazanan +50 bonus XP alır.

### 7. Sıralama & Seviye
- Kayıtlı oyuncular XP kazanır ve seviye atlar
- Haftalık ve aylık sıralama tablosu
- Misafirler sıralamaya dahil olmaz

---

## Özellikler

- **Gerçek zamanlı multiplayer** — Socket.IO ile anlık iletişim
- **Canlı sohbet** — lobi ve oda içi mesajlaşma + emoji reaksiyonları (👍 👏 😂 😮 😡 🔥 💯 ⭐)
- **Kanıt sistemi** — oylama sırasında cevabını kanıtlamak için görsel yükle
- **Özelleştirilebilir kategoriler** — 40+ hazır kategori veya kendi kategorini ekle
- **Özelleştirilebilir harfler** — istemediğin harfleri kapat
- **Misafir modu** — kayıt olmadan hemen oyna
- **Davet linki** — arkadaşlarına tek tıkla oda linki gönder
- **Admin paneli** — kullanıcı yönetimi, duyuru sistemi, raporlar, iletişim mesajları
- **Responsive retro UI** — piksel sanat estetiğinde tasarım
- **Türkçe harf havuzu** — 29 harfli Türk alfabesine özel frekans dağılımı

---

## Ekranlar

| Ekran | Açıklama |
|-------|----------|
| **Lobi** | Oda listesi, arama, oda oluşturma, online sayısı |
| **Oda** | Ayarlar, kategori/harf seçimi, oyuncu listesi, sohbet |
| **Oyun** | Cevap girişi, geri sayım, canlı sohbet |
| **Oylama** | Cevaplara oy verme, kanıt yükleme, kategori navigasyonu |
| **Skor Tablosu** | Tur detayları, final sıralaması, kategori bazlı dağılım |
| **Profil** | İstatistikler, veri yönetimi, hesap ayarları |
| **Sıralama** | Haftalık ve aylık liderboard |
| **Admin** | Dashboard, kullanıcı/oda yönetimi, duyurular, loglar |

---

## Kurulum

### Gereksinimler

- [Docker](https://www.docker.com/get-started) & Docker Compose

### Başlatma

```bash
# Klonla
git clone https://github.com/your-username/katmanisimsehir.git
cd katmanisimsehir

# .env dosyasını oluştur ve düzenle
cp .env.example .env

# Development
docker compose -p isk -f docker-compose.dev.yml up --build

# Production
docker compose -p isk -f docker-compose.prod.yml up -d --build

# Migration & Seed (ilk kurulumda)
docker compose -p isk -f docker-compose.dev.yml exec app node server/db/migrate.js
docker compose -p isk -f docker-compose.dev.yml exec app node server/db/seed.js
```

Development: `localhost:3007` — Production: Nginx üzerinden `80/443`

---

## Teknolojiler

| | |
|--|--|
| **Backend** | Node.js 20, Express 4, PostgreSQL 16 |
| **Gerçek Zamanlı** | Socket.IO 4 |
| **Frontend** | Vanilla JS SPA, Tailwind CSS 3 |
| **Auth** | JWT + Refresh Token, bcrypt |
| **Altyapı** | Docker multi-stage, Nginx reverse proxy |
| **Test** | Jest + Supertest |

---

## Lisans

Bu proje [MIT](LICENSE) lisansı ile lisanslanmıştır.
