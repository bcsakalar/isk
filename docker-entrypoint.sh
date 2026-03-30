#!/bin/sh
set -e

echo "=========================================="
echo " Katman İsim Şehir — Container Başlatılıyor"
echo " NODE_ENV: ${NODE_ENV:-development}"
echo "=========================================="

# ── 1. Migration ──────────────────────────────
echo "[entrypoint] Migration çalıştırılıyor..."
node server/db/migrate.js
echo "[entrypoint] Migration tamamlandı."

# ── 2. Seed ───────────────────────────────────
echo "[entrypoint] Seed çalıştırılıyor..."
if node server/db/seed.js; then
  echo "[entrypoint] Seed tamamlandı."
else
  echo "[entrypoint] UYARI: Seed başarısız oldu, devam ediliyor..."
fi

# ── 3. Ortama göre başlat ────────────────────
if [ "$NODE_ENV" = "production" ]; then
  echo "[entrypoint] Production modu — Server başlatılıyor..."
  exec node server/index.js
else
  echo "[entrypoint] Development modu — Tailwind watch + Nodemon başlatılıyor..."
  # Tailwind CSS watch modda arka planda çalıştır
  npx tailwindcss -i ./client/css/tailwind.css -o ./client/css/output.css --watch &
  # exec ile nodemon'u PID 1 olarak çalıştır (graceful shutdown için)
  exec npx nodemon server/index.js
fi
