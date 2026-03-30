const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../server/services/kvkk.service');

const kvkkService = require('../../server/services/kvkk.service');
const { createTestApp } = require('../helpers/testApp');

const app = createTestApp();
const TEST_SECRET = process.env.JWT_SECRET || 'test-secret-key';

function generateToken(payload = { id: 1, username: 'testuser', role: 'player' }) {
  return jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });
}

describe('POST /api/kvkk/accept-privacy', () => {
  it('gizlilik onayı başarılı → 200', async () => {
    kvkkService.acceptPrivacy.mockResolvedValue({ version: '1.0' });

    const res = await request(app)
      .post('/api/kvkk/accept-privacy')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.version).toBe('1.0');
  });

  it('token olmadan → 401', async () => {
    const res = await request(app)
      .post('/api/kvkk/accept-privacy')
      .send();

    expect(res.status).toBe(401);
  });
});

describe('GET /api/kvkk/privacy-status', () => {
  it('onay durumunu döndürmeli', async () => {
    kvkkService.getPrivacyStatus.mockResolvedValue({
      accepted: true,
      version: '1.0',
      acceptedAt: new Date().toISOString(),
      deletionRequested: false,
      consents: [],
    });

    const res = await request(app)
      .get('/api/kvkk/privacy-status')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accepted).toBe(true);
  });
});

describe('POST /api/kvkk/request-deletion', () => {
  it('silme talebi oluşturmalı', async () => {
    kvkkService.requestDeletion.mockResolvedValue({
      id: 1,
      requested_at: new Date().toISOString(),
      scheduled_for: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const res = await request(app)
      .post('/api/kvkk/request-deletion')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ reason: 'Test' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('silme talebi');
  });

  it('zaten aktif talep varsa → hata', async () => {
    const { BadRequestError } = require('../../server/utils/errors');
    kvkkService.requestDeletion.mockRejectedValue(
      new BadRequestError('Zaten aktif bir silme talebiniz bulunuyor')
    );

    const res = await request(app)
      .post('/api/kvkk/request-deletion')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ reason: 'Test' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/kvkk/cancel-deletion', () => {
  it('silme iptali başarılı', async () => {
    kvkkService.cancelDeletion.mockResolvedValue();

    const res = await request(app)
      .post('/api/kvkk/cancel-deletion')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('iptal');
  });
});

describe('GET /api/kvkk/export', () => {
  it('kullanıcı verilerini döndürmeli', async () => {
    kvkkService.exportData.mockResolvedValue({
      user: { id: 1, username: 'testuser' },
      consents: [],
      games: [],
    });

    const res = await request(app)
      .get('/api/kvkk/export')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.consents).toBeDefined();
    expect(res.body.data.games).toBeDefined();
  });

  it('token olmadan → 401', async () => {
    const res = await request(app)
      .get('/api/kvkk/export');

    expect(res.status).toBe(401);
  });
});
