const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../server/db/queries/admin.queries');
jest.mock('../../server/db/queries/users.queries');
jest.mock('../../server/db/queries/rooms.queries');
jest.mock('../../server/db/queries/games.queries');
jest.mock('../../server/services/contact.service');

const usersQueries = require('../../server/db/queries/users.queries');
const { createTestApp } = require('../helpers/testApp');

const app = createTestApp();
const TEST_SECRET = process.env.JWT_SECRET || 'test-secret-key';

describe('DoS Koruması — Input Validasyon Testleri', () => {
  describe('Admin search param uzunluk sınırı', () => {
    beforeEach(() => {
      usersQueries.findById.mockResolvedValue({
        id: 99, username: 'admin', role: 'admin', is_banned: false,
      });
      usersQueries.searchUsers.mockResolvedValue([]);
    });

    it('normal arama çalışmalı', async () => {
      const token = jwt.sign({ id: 99, username: 'admin', role: 'admin' }, TEST_SECRET);

      const res = await request(app)
        .get('/api/admin/users?search=ali')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(usersQueries.searchUsers).toHaveBeenCalledWith('ali');
    });

    it('100+ karakter string kesilmeli', async () => {
      const token = jwt.sign({ id: 99, username: 'admin', role: 'admin' }, TEST_SECRET);
      const longSearch = 'A'.repeat(200);

      const res = await request(app)
        .get(`/api/admin/users?search=${longSearch}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      // searchUsers 100 karaktere kesilmiş string ile çağrılmalı
      expect(usersQueries.searchUsers).toHaveBeenCalledWith('A'.repeat(100));
    });
  });

  describe('Kategori sayısı sınırı', () => {
    it('50\'den fazla kategori ile oda oluşturma reddedilmeli', async () => {
      const roomService = require('../../server/services/room.service');
      const categoryIds = Array.from({ length: 60 }, (_, i) => i + 1);

      // Mock room creation dependencies
      const roomsQueries = require('../../server/db/queries/rooms.queries');
      roomsQueries.findByCode.mockResolvedValue(null);
      roomsQueries.create.mockResolvedValue({ id: 1, code: 'ABC123' });

      await expect(
        roomService.createRoom({
          userId: 1,
          name: 'Test Odası',
          categoryIds,
        })
      ).rejects.toThrow('En fazla 50 kategori seçilebilir');
    });
  });
});
