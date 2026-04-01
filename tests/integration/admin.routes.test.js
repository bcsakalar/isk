const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../server/db/queries/admin.queries');
jest.mock('../../server/db/queries/users.queries');
jest.mock('../../server/db/queries/rooms.queries');
jest.mock('../../server/db/queries/games.queries');
jest.mock('../../server/services/contact.service');

const adminQueries = require('../../server/db/queries/admin.queries');
const usersQueries = require('../../server/db/queries/users.queries');
const roomsQueries = require('../../server/db/queries/rooms.queries');
const gamesQueries = require('../../server/db/queries/games.queries');
const contactService = require('../../server/services/contact.service');
const { createTestApp } = require('../helpers/testApp');

const app = createTestApp();
const TEST_SECRET = process.env.JWT_SECRET || 'test-secret-key';

function generateAdminToken() {
  return jwt.sign({ id: 99, username: 'admin', role: 'admin' }, TEST_SECRET, { expiresIn: '1h' });
}

function generatePlayerToken() {
  return jwt.sign({ id: 1, username: 'player', role: 'player' }, TEST_SECRET, { expiresIn: '1h' });
}

beforeEach(() => {
  // Admin kullanıcı
  usersQueries.findById.mockImplementation((id) => {
    if (id === 99) return Promise.resolve({ id: 99, username: 'admin', role: 'admin', is_banned: false });
    if (id === 1) return Promise.resolve({ id: 1, username: 'player', role: 'player', is_banned: false });
    return Promise.resolve(null);
  });
});

describe('Admin yetkilendirme', () => {
  it('admin olmayan kullanıcı → 403', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${generatePlayerToken()}`);

    expect(res.status).toBe(403);
  });

  it('token olmadan → 401', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/dashboard', () => {
  it('admin → dashboard verisi → 200', async () => {
    adminQueries.getStats.mockResolvedValue({ totalUsers: 50, activeRooms: 3 });

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${generateAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalUsers).toBe(50);
  });
});

describe('GET /api/admin/users', () => {
  it('kullanıcı listesi → 200', async () => {
    usersQueries.listAllForAdmin.mockResolvedValue([{ id: 1, username: 'user1', role: 'player', is_banned: false }]);

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${generateAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(usersQueries.listAllForAdmin).toHaveBeenCalledWith(100);
  });

  it('arama ile → searchUsers çağrılmalı', async () => {
    usersQueries.searchUsers.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/admin/users?search=test')
      .set('Authorization', `Bearer ${generateAdminToken()}`);

    expect(res.status).toBe(200);
    // search paramı güvenlik için 100 karaktere sınırlandırılır
    expect(usersQueries.searchUsers).toHaveBeenCalledWith('test');
  });
});

describe('GET /api/admin/users/:userId', () => {
  it('kullanıcı detay → şifre hariç → 200', async () => {
    usersQueries.findById.mockImplementation((id) => {
      if (id === 5) return Promise.resolve({ id: 5, username: 'testuser', display_name: 'Test', email: 'test@test.com', role: 'player', password_hash: 'secret', level: 3, xp: 100 });
      if (id === 99) return Promise.resolve({ id: 99, username: 'admin', role: 'admin', is_banned: false });
      return Promise.resolve(null);
    });

    const res = await request(app)
      .get('/api/admin/users/5')
      .set('Authorization', `Bearer ${generateAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('testuser');
    expect(res.body.data.password_hash).toBeUndefined();
  });

  it('olmayan kullanıcı → 404', async () => {
    usersQueries.findById.mockImplementation((id) => {
      if (id === 99) return Promise.resolve({ id: 99, username: 'admin', role: 'admin', is_banned: false });
      return Promise.resolve(null);
    });

    const res = await request(app)
      .get('/api/admin/users/9999')
      .set('Authorization', `Bearer ${generateAdminToken()}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/admin/users/:userId/ban', () => {
  it('kullanıcı yasaklama → 200', async () => {
    usersQueries.banUser.mockResolvedValue();
    adminQueries.logAction.mockResolvedValue();

    const res = await request(app)
      .post('/api/admin/users/1/ban')
      .set('Authorization', `Bearer ${generateAdminToken()}`)
      .send({ reason: 'Kural ihlali' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('yasaklandı');
  });
});

describe('POST /api/admin/users/:userId/unban', () => {
  it('yasak kaldırma → 200', async () => {
    usersQueries.unbanUser.mockResolvedValue();
    adminQueries.logAction.mockResolvedValue();

    const res = await request(app)
      .post('/api/admin/users/1/unban')
      .set('Authorization', `Bearer ${generateAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('kaldırıldı');
  });
});

describe('POST /api/admin/users/:userId/role', () => {
  it('rol güncelleme → 200', async () => {
    usersQueries.setRole.mockResolvedValue();
    adminQueries.logAction.mockResolvedValue();

    const res = await request(app)
      .post('/api/admin/users/1/role')
      .set('Authorization', `Bearer ${generateAdminToken()}`)
      .send({ role: 'moderator' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('güncellendi');
  });

  it('geçersiz rol → 400', async () => {
    const res = await request(app)
      .post('/api/admin/users/1/role')
      .set('Authorization', `Bearer ${generateAdminToken()}`)
      .send({ role: 'superadmin' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/admin/rooms', () => {
  it('aktif oda listesi → 200', async () => {
    roomsQueries.listActive.mockResolvedValue([{ id: 1, name: 'Oda', status: 'waiting' }]);

    const res = await request(app)
      .get('/api/admin/rooms')
      .set('Authorization', `Bearer ${generateAdminToken()}`);

    expect(res.status).toBe(200);
    expect(roomsQueries.listActive).toHaveBeenCalledWith(100);
  });
});

describe('GET /api/admin/rooms/:roomId', () => {
  it('oda detay → oyuncular ve kategoriler ile → 200', async () => {
    roomsQueries.findById.mockResolvedValue({ id: 1, name: 'Test Oda', code: 'ABC123', status: 'playing', max_players: 6 });
    roomsQueries.getPlayers.mockResolvedValue([{ id: 10, username: 'p1', display_name: 'Player 1', level: 3 }]);
    roomsQueries.getCategories.mockResolvedValue([{ id: 1, name: 'Hayvan' }]);

    const res = await request(app)
      .get('/api/admin/rooms/1')
      .set('Authorization', `Bearer ${generateAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Test Oda');
    expect(res.body.data.players).toHaveLength(1);
    expect(res.body.data.categories).toHaveLength(1);
  });

  it('olmayan oda → 404', async () => {
    roomsQueries.findById.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/admin/rooms/9999')
      .set('Authorization', `Bearer ${generateAdminToken()}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/admin/rooms/:roomId/close', () => {
  it('oda kapatma → 200', async () => {
    roomsQueries.updateStatus.mockResolvedValue();
    adminQueries.logAction.mockResolvedValue();

    const res = await request(app)
      .post('/api/admin/rooms/1/close')
      .set('Authorization', `Bearer ${generateAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('kapatıldı');
  });
});

describe('DELETE /api/admin/rooms/:roomId', () => {
  it('oda kapatma (DELETE) → 200', async () => {
    roomsQueries.updateStatus.mockResolvedValue();
    adminQueries.logAction.mockResolvedValue();

    const res = await request(app)
      .delete('/api/admin/rooms/1')
      .set('Authorization', `Bearer ${generateAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('kapatıldı');
  });
});

describe('POST /api/admin/announcements', () => {
  it('duyuru oluşturma → 201', async () => {
    adminQueries.createAnnouncement.mockResolvedValue({ id: 1, title: 'Test' });
    adminQueries.logAction.mockResolvedValue();

    const res = await request(app)
      .post('/api/admin/announcements')
      .set('Authorization', `Bearer ${generateAdminToken()}`)
      .send({ title: 'Test', content: 'İçerik' });

    expect(res.status).toBe(201);
  });
});

describe('GET /api/admin/logs', () => {
  it('log listesi → 200', async () => {
    adminQueries.getLogs.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${generateAdminToken()}`);

    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/admin/announcements/:id', () => {
  it('duyuru silme → 200', async () => {
    adminQueries.deleteAnnouncement.mockResolvedValue({ id: 1 });
    adminQueries.logAction.mockResolvedValue();

    const res = await request(app)
      .delete('/api/admin/announcements/1')
      .set('Authorization', `Bearer ${generateAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('silindi');
    expect(adminQueries.deleteAnnouncement).toHaveBeenCalledWith(1);
  });

  it('olmayan duyuru → 404', async () => {
    adminQueries.deleteAnnouncement.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/admin/announcements/999')
      .set('Authorization', `Bearer ${generateAdminToken()}`);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/admin/contact/:id', () => {
  it('iletişim mesajı silme → 200', async () => {
    contactService.deleteMessage.mockResolvedValue({ id: 1 });
    adminQueries.logAction.mockResolvedValue();

    const res = await request(app)
      .delete('/api/admin/contact/1')
      .set('Authorization', `Bearer ${generateAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('silindi');
  });

  it('olmayan mesaj → 404', async () => {
    const { NotFoundError } = require('../../server/utils/errors');
    contactService.deleteMessage.mockRejectedValue(new NotFoundError('Mesaj bulunamadı'));

    const res = await request(app)
      .delete('/api/admin/contact/999')
      .set('Authorization', `Bearer ${generateAdminToken()}`);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/admin/logs', () => {
  it('logları temizleme → 200', async () => {
    adminQueries.clearLogs.mockResolvedValue(10);

    const res = await request(app)
      .delete('/api/admin/logs')
      .set('Authorization', `Bearer ${generateAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('temizlendi');
  });
});
