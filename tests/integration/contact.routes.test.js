const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../server/services/contact.service');
jest.mock('../../server/db/queries/admin.queries');
jest.mock('../../server/db/queries/users.queries');

const contactService = require('../../server/services/contact.service');
const adminQueries = require('../../server/db/queries/admin.queries');
const usersQueries = require('../../server/db/queries/users.queries');
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
  usersQueries.findById.mockImplementation((id) => {
    if (id === 99) return Promise.resolve({ id: 99, username: 'admin', role: 'admin', is_banned: false });
    if (id === 1) return Promise.resolve({ id: 1, username: 'player', role: 'player', is_banned: false });
    return Promise.resolve(null);
  });
});

const validBody = {
  name: 'Ali Veli',
  email: 'ali@test.com',
  subject: 'Destek talebi',
  message: 'Bu bir test mesajıdır, yeterince uzun olmalı.',
};

describe('POST /api/contact', () => {
  it('geçerli form → 201', async () => {
    contactService.submitMessage.mockResolvedValue({ id: 1 });

    const res = await request(app)
      .post('/api/contact')
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(1);
    expect(res.body.message).toContain('başarıyla gönderildi');
  });

  it('validasyon hatası → 400', async () => {
    const { BadRequestError } = require('../../server/utils/errors');
    contactService.submitMessage.mockRejectedValue(
      new BadRequestError('İsim 2-100 karakter arasında olmalıdır')
    );

    const res = await request(app)
      .post('/api/contact')
      .send({ ...validBody, name: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('auth gerektirmemeli (token olmadan çalışmalı)', async () => {
    contactService.submitMessage.mockResolvedValue({ id: 2 });

    const res = await request(app)
      .post('/api/contact')
      .send(validBody);

    expect(res.status).toBe(201);
  });
});

describe('GET /api/admin/contact', () => {
  it('admin → mesaj listesi → 200', async () => {
    contactService.getMessages.mockResolvedValue([
      { id: 1, name: 'Ali', subject: 'Test', is_read: false },
    ]);

    const res = await request(app)
      .get('/api/admin/contact')
      .set('Authorization', `Bearer ${generateAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('admin olmayan → 403', async () => {
    const res = await request(app)
      .get('/api/admin/contact')
      .set('Authorization', `Bearer ${generatePlayerToken()}`);

    expect(res.status).toBe(403);
  });

  it('token olmadan → 401', async () => {
    const res = await request(app).get('/api/admin/contact');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/contact/unread-count', () => {
  it('admin → okunmamış sayısı → 200', async () => {
    contactService.getUnreadCount.mockResolvedValue(3);

    const res = await request(app)
      .get('/api/admin/contact/unread-count')
      .set('Authorization', `Bearer ${generateAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.count).toBe(3);
  });
});

describe('POST /api/admin/contact/:id/read', () => {
  it('admin → okundu işaretleme → 200', async () => {
    contactService.markAsRead.mockResolvedValue({ id: 1, is_read: true });
    adminQueries.logAction.mockResolvedValue();

    const res = await request(app)
      .post('/api/admin/contact/1/read')
      .set('Authorization', `Bearer ${generateAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('olmayan mesaj → 404', async () => {
    const { NotFoundError } = require('../../server/utils/errors');
    contactService.markAsRead.mockRejectedValue(
      new NotFoundError('Mesaj bulunamadı')
    );

    const res = await request(app)
      .post('/api/admin/contact/999/read')
      .set('Authorization', `Bearer ${generateAdminToken()}`);

    expect(res.status).toBe(404);
  });
});
