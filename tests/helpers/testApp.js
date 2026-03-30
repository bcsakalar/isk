const express = require('express');

/**
 * Test için minimal Express uygulaması oluşturur.
 * Gerçek veritabanı veya socket bağlantısı gerektirmez.
 */
function createTestApp() {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // Auth routes
  const authRoutes = require('../../server/routes/auth.routes');
  app.use('/api/auth', authRoutes);

  // Room routes
  const roomRoutes = require('../../server/routes/room.routes');
  app.use('/api/rooms', roomRoutes);

  // Game routes
  const gameRoutes = require('../../server/routes/game.routes');
  app.use('/api/game', gameRoutes);

  // Admin routes
  const adminRoutes = require('../../server/routes/admin.routes');
  app.use('/api/admin', adminRoutes);

  // KVKK routes
  const kvkkRoutes = require('../../server/routes/kvkk.routes');
  app.use('/api/kvkk', kvkkRoutes);

  // Contact routes
  const contactRoutes = require('../../server/routes/contact.routes');
  app.use('/api/contact', contactRoutes);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Error handler (gerçek uygulamadaki ile aynı mantık)
  app.use((err, req, res, _next) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: err.isOperational ? err.message : 'Sunucu hatası',
    });
  });

  return app;
}

module.exports = { createTestApp };
