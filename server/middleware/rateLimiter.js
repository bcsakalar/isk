const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// Genel rate limit
const generalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek gönderdiniz, lütfen bekleyin.', code: 'RATE_LIMITED' },
  keyGenerator: (req) => req.ip,
});

// Auth endpoint'leri için sıkı limit
const authLimiter = rateLimit({
  windowMs: 60000, // 1 dakika
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla giriş denemesi, lütfen bekleyin.', code: 'RATE_LIMITED' },
  keyGenerator: (req) => req.ip,
});

// Kayıt için çok sıkı limit
const registerLimiter = rateLimit({
  windowMs: 3600000, // 1 saat
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla kayıt denemesi, lütfen bekleyin.', code: 'RATE_LIMITED' },
  keyGenerator: (req) => req.ip,
});

// API genel limit
const apiLimiter = rateLimit({
  windowMs: 60000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'API istek limiti aşıldı.', code: 'RATE_LIMITED' },
  keyGenerator: (req) => req.user ? `user_${req.user.id}` : req.ip,
});

// İletişim formu için sıkı limit (bot koruması)
const contactLimiter = rateLimit({
  windowMs: 3600000, // 1 saat
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla mesaj gönderdiniz, lütfen daha sonra tekrar deneyin.', code: 'RATE_LIMITED' },
  keyGenerator: (req) => req.ip,
});

module.exports = { generalLimiter, authLimiter, registerLimiter, apiLimiter, contactLimiter };
