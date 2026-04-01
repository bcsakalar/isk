const http = require('http');
const express = require('express');
const path = require('path');
const env = require('./config/env');
const corsConfig = require('./config/cors');
const helmetConfig = require('./middleware/helmet');
const { generalLimiter } = require('./middleware/rateLimiter');
const { sanitizeInput } = require('./middleware/sanitizer');
const initSocket = require('./socket');
const logger = require('./utils/logger');

// Routes
const authRoutes = require('./routes/auth.routes');
const roomRoutes = require('./routes/room.routes');
const gameRoutes = require('./routes/game.routes');
const userRoutes = require('./routes/user.routes');
const adminRoutes = require('./routes/admin.routes');
const leaderboardRoutes = require('./routes/leaderboard.routes');
const kvkkRoutes = require('./routes/kvkk.routes');
const contactRoutes = require('./routes/contact.routes');

// Cron Jobs
const roomCleanupJob = require('./jobs/roomCleanup.job');
const sessionCleanupJob = require('./jobs/sessionCleanup.job');
const chatPurgeJob = require('./jobs/chatPurge.job');
const leaderboardResetJob = require('./jobs/leaderboardReset.job');
const guestCleanupJob = require('./jobs/guestCleanup.job');
const accountDeletionJob = require('./jobs/accountDeletion.job');

const app = express();
const server = http.createServer(app);

// Nginx reverse proxy arkasında gerçek IP'yi al
app.set('trust proxy', 1);

// ======= MIDDLEWARE =======
app.use(helmetConfig);
app.use(corsConfig);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(sanitizeInput);

// Rate limit + cache sadece API istekleri için
app.use('/api', generalLimiter);
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
});

// Admin panel güvenlik headerları
app.use('/admin', (req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

// ======= STATIC FILES =======
const staticCacheOptions = {
  maxAge: '7d',
  setHeaders: (res, filePath) => {
    // CSS ve JS dosyaları her zaman doğrulansın (deploy sonrası hemen güncellenir)
    if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
  }
};
app.use(express.static(path.join(__dirname, '..', 'client'), staticCacheOptions));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin'), staticCacheOptions));

// ======= API ROUTES =======
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/kvkk', kvkkRoutes);
app.use('/api/contact', contactRoutes);

// ======= HEALTH CHECK =======
app.get('/api/health', generalLimiter, (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ======= READINESS PROBE =======
app.get('/api/ready', generalLimiter, async (req, res) => {
  try {
    const { query: dbQuery } = require('./config/database');
    await dbQuery('SELECT 1');
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not ready' });
  }
});

// ======= SPA FALLBACK =======
app.get('*', (req, res) => {
  if (req.path.startsWith('/admin')) {
    return res.sendFile(path.join(__dirname, '..', 'admin', 'index.html'));
  }
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// ======= ERROR HANDLER =======
app.use((err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational || false;

  if (!isOperational) {
    logger.error('Unexpected error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  res.status(statusCode).json({
    success: false,
    message: isOperational ? err.message : 'Sunucu hatası',
    ...(env.nodeEnv === 'development' && { stack: err.stack }),
  });
});

// ======= SOCKET.IO =======
const io = initSocket(server);
app.set('io', io);

// ======= CRON JOBS =======
roomCleanupJob.start();
sessionCleanupJob.start();
chatPurgeJob.start();
leaderboardResetJob.start();
guestCleanupJob.start();
accountDeletionJob.start();
logger.info('Cron jobs started');

// ======= START SERVER =======
server.listen(env.port, () => {
  logger.info(`Server running on port ${env.port}`, {
    env: env.nodeEnv,
    port: env.port,
  });
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`${signal} received, shutting down gracefully`);

  roomCleanupJob.stop();
  sessionCleanupJob.stop();
  chatPurgeJob.stop();
  leaderboardResetJob.stop();
  guestCleanupJob.stop();
  accountDeletionJob.stop();

  io.close();

  server.close(() => {
    logger.info('HTTP server closed');
    const { pool } = require('./config/database');
    pool.end().then(() => {
      logger.info('Database pool closed');
      process.exit(0);
    });
  });

  // Zorla kapat 10 saniyede
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

module.exports = { app, server };
