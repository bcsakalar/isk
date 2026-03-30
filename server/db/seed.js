const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { query, pool } = require('../config/database');
const env = require('../config/env');
const logger = require('../utils/logger');

async function seed() {
  try {
    logger.info('Running seed files...');

    // 1. Kategori ve Achievement seed'leri
    const categorySeedPath = path.join(__dirname, 'seeds', 'categories.seed.sql');
    const categorySql = fs.readFileSync(categorySeedPath, 'utf8');
    await query(categorySql);
    logger.info('Categories and achievements seeded');

    // 2. Admin kullanıcı oluştur
    const adminUsername = env.admin?.username || 'admin';
    const adminEmail = env.admin?.email || 'admin@isimkentoyunu.com';
    const adminPassword = env.admin?.password || 'Admin123!';

    // Zaten var mı kontrol et
    const existing = await query('SELECT id FROM users WHERE username = $1', [adminUsername]);
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(adminPassword, 12);
      await query(
        `INSERT INTO users (username, email, password_hash, display_name, role)
         VALUES ($1, $2, $3, $4, 'admin')`,
        [adminUsername, adminEmail, hash, adminUsername]
      );
      logger.info('Admin user created', { username: adminUsername });
    } else {
      logger.info('Admin user already exists, skipping');
    }

    logger.info('All seeds completed successfully');
  } catch (err) {
    logger.error('Seed failed', { error: err.message, stack: err.stack });
    throw err;
  } finally {
    await pool.end();
  }
}

seed().catch(() => process.exit(1));
