const jwt = require('jsonwebtoken');
const request = require('supertest');

jest.mock('../../server/services/auth.service');
jest.mock('../../server/db/queries/users.queries');

const authService = require('../../server/services/auth.service');
const usersQueries = require('../../server/db/queries/users.queries');
const { createTestApp } = require('../helpers/testApp');

const app = createTestApp();
const TEST_SECRET = process.env.JWT_SECRET || 'test-secret-key';

describe('Auth Güvenlik Testleri', () => {
  describe('JWT güvenliği', () => {
    it('farklı secret ile imzalanmış token reddedilmeli', async () => {
      const fakeToken = jwt.sign({ id: 1, username: 'hacker', role: 'admin' }, 'wrong-secret');

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${fakeToken}`);

      expect(res.status).toBe(401);
    });

    it('süresi dolmuş token reddedilmeli', async () => {
      const expiredToken = jwt.sign({ id: 1, username: 'test' }, TEST_SECRET, { expiresIn: '-1s' });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    it('bozuk token reddedilmeli', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not.a.real.token');

      expect(res.status).toBe(401);
    });

    it('algorithm none saldırısı reddedilmeli', async () => {
      // none algorithm ile token oluştur — middleware bunu kabul etmemeli
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ id: 1, username: 'admin', role: 'admin' })).toString('base64url');
      const noneToken = `${header}.${payload}.`;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${noneToken}`);

      expect(res.status).toBe(401);
    });

    it('token olmadan korumalı route\'a erişim engellenmeli', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(401);
    });

    it('Bearer prefix olmadan token reddedilmeli', async () => {
      const token = jwt.sign({ id: 1 }, TEST_SECRET);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', token);

      expect(res.status).toBe(401);
    });
  });

  describe('Yetki yükseltme koruması', () => {
    it('player token ile admin route\'a erişim engellenmeli', async () => {
      usersQueries.findById.mockResolvedValue({
        id: 1, username: 'player', role: 'player', is_banned: false,
      });
      const token = jwt.sign({ id: 1, username: 'player', role: 'player' }, TEST_SECRET);

      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('JWT secret ile imzalanmış token güvenilir — role DB\'den doğrulanır', async () => {
      // JWT secret ile imzalandığı için token payload'ındaki role güvenilirdir
      // adminGuard DB'den role doğrulaması yapar (güçlendirilmiş davranış)
      const adminQueries = require('../../server/db/queries/admin.queries');
      adminQueries.getStats = jest.fn().mockResolvedValue({ totalUsers: 1 });
      usersQueries.findById.mockResolvedValue({ id: 1, username: 'test', role: 'admin', is_banned: false });

      const fakeAdminToken = jwt.sign({ id: 1, username: 'test', role: 'admin' }, TEST_SECRET);

      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${fakeAdminToken}`);

      // Token doğru secret ile imzalandığı ve DB'de admin rolü onaylandığı için erişim verilir
      expect(res.status).toBe(200);
    });;
  });

  describe('Yasaklı kullanıcı koruması', () => {
    it('yasaklı kullanıcı korumalı endpointe erişememeli', async () => {
      usersQueries.findById.mockResolvedValue({
        id: 1, username: 'banned', role: 'player', is_banned: true,
      });
      const token = jwt.sign({ id: 1, username: 'banned', role: 'player' }, TEST_SECRET);

      const res = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
    });
  });

  describe('password_hash sızma koruması', () => {
    it('/api/auth/me password_hash döndürmemeli', async () => {
      usersQueries.findById.mockResolvedValue({
        id: 1, username: 'test', role: 'player', is_banned: false,
        email: null, password_hash: '$2b$10$hashedpassword',
      });
      const token = jwt.sign({ id: 1, username: 'test', role: 'player' }, TEST_SECRET);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.password_hash).toBeUndefined();
    });
  });
});
