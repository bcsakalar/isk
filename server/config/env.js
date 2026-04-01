const path = require('path');

// .env dosyası varsa yükle (production'da ortam değişkenleri zaten set edilmiş olur)
try {
  const fs = require('fs');
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
} catch (_) { /* ignore */ }

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'katmanisimsehir',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  cleanup: {
    roomInactiveMinutes: parseInt(process.env.ROOM_INACTIVE_MINUTES, 10) || 30,
    chatRetentionDays: parseInt(process.env.CHAT_RETENTION_DAYS, 10) || 7,
    sessionCleanupHours: parseInt(process.env.SESSION_CLEANUP_HOURS, 10) || 1,
  },

  admin: {
    username: process.env.ADMIN_INITIAL_USERNAME || 'admin',
    email: process.env.ADMIN_INITIAL_EMAIL || 'admin@isimsehirkatman.com',
    password: process.env.ADMIN_INITIAL_PASSWORD || 'Admin123!',
  },
};

// Production ortamında güvenlik kontrolleri
if (config.nodeEnv === 'production') {
  const INSECURE_SECRETS = ['dev-secret-change-me', 'dev-refresh-secret-change-me'];
  if (INSECURE_SECRETS.includes(config.jwt.secret) || INSECURE_SECRETS.includes(config.jwt.refreshSecret)) {
    throw new Error('KRITIK: Production ortamında JWT_SECRET ve JWT_REFRESH_SECRET değiştirilmeli! Varsayılan değerler güvenli değil.');
  }
  if (!config.db.password) {
    throw new Error('KRITIK: Production ortamında DB_PASSWORD boş bırakılamaz!');
  }
  if (config.admin.password === 'Admin123!') {
    throw new Error('KRITIK: Production ortamında ADMIN_INITIAL_PASSWORD değiştirilmeli! Varsayılan şifre güvenli değil.');
  }
}

module.exports = config;
