const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../server/db/queries/admin.queries');
jest.mock('../../server/db/queries/users.queries');
jest.mock('../../server/db/queries/rooms.queries');
jest.mock('../../server/db/queries/games.queries');
jest.mock('../../server/services/contact.service');

const usersQueries = require('../../server/db/queries/users.queries');
const adminQueries = require('../../server/db/queries/admin.queries');
const { createTestApp } = require('../helpers/testApp');

const app = createTestApp();
const TEST_SECRET = process.env.JWT_SECRET || 'test-secret-key';

describe('Yetkilendirme (RBAC) Güvenlik Testleri', () => {
  describe('Admin Guard — DB role doğrulama', () => {
    it('JWT role=admin ama DB role=player → 403 (privilege escalation engellemesi)', async () => {
      // JWT'de admin claim var ama DB'de rolü player'a düşürülmüş
      usersQueries.findById.mockResolvedValue({
        id: 1, username: 'demoted', role: 'player', is_banned: false,
      });

      const token = jwt.sign({ id: 1, username: 'demoted', role: 'admin' }, TEST_SECRET);

      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('JWT role=admin ve DB role=admin → 200', async () => {
      usersQueries.findById.mockResolvedValue({
        id: 10, username: 'realadmin', role: 'admin', is_banned: false,
      });
      adminQueries.getStats.mockResolvedValue({ totalUsers: 1 });

      const token = jwt.sign({ id: 10, username: 'realadmin', role: 'admin' }, TEST_SECRET);

      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('silinen kullanıcı (DB null) → 403', async () => {
      usersQueries.findById.mockResolvedValue(null);

      const token = jwt.sign({ id: 999, username: 'deleted', role: 'admin' }, TEST_SECRET);

      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('player token ile admin ban endpoint → 403', async () => {
      usersQueries.findById.mockResolvedValue({
        id: 2, username: 'player', role: 'player', is_banned: false,
      });

      const token = jwt.sign({ id: 2, username: 'player', role: 'player' }, TEST_SECRET);

      const res = await request(app)
        .post('/api/admin/users/1/ban')
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'test' });

      expect(res.status).toBe(403);
    });

    it('player token ile admin role endpoint → 403', async () => {
      usersQueries.findById.mockResolvedValue({
        id: 2, username: 'player', role: 'player', is_banned: false,
      });

      const token = jwt.sign({ id: 2, username: 'player', role: 'player' }, TEST_SECRET);

      const res = await request(app)
        .post('/api/admin/users/1/role')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(403);
    });

    it('moderator token ile admin endpoint → 403', async () => {
      usersQueries.findById.mockResolvedValue({
        id: 3, username: 'mod', role: 'moderator', is_banned: false,
      });

      const token = jwt.sign({ id: 3, username: 'mod', role: 'moderator' }, TEST_SECRET);

      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Token yokluğu koruması', () => {
    const protectedAdminRoutes = [
      ['GET', '/api/admin/dashboard'],
      ['GET', '/api/admin/users'],
      ['GET', '/api/admin/rooms'],
      ['GET', '/api/admin/logs'],
      ['POST', '/api/admin/announcements'],
    ];

    protectedAdminRoutes.forEach(([method, path]) => {
      it(`${method} ${path} — token olmadan → 401`, async () => {
        const req = method === 'GET'
          ? request(app).get(path)
          : request(app).post(path).send({});

        const res = await req;
        expect(res.status).toBe(401);
      });
    });
  });
});
