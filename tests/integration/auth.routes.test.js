const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock tüm service ve query katmanlarını
jest.mock('../../server/services/auth.service');
jest.mock('../../server/db/queries/users.queries');

const authService = require('../../server/services/auth.service');
const usersQueries = require('../../server/db/queries/users.queries');
const { createTestApp } = require('../helpers/testApp');

const app = createTestApp();
const TEST_SECRET = process.env.JWT_SECRET || 'test-secret-key';

function generateToken(payload = { id: 1, username: 'testuser', role: 'player' }) {
  return jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });
}

describe('POST /api/auth/register', () => {
  it('başarılı kayıt → 201', async () => {
    authService.register.mockResolvedValue({
      user: { id: 1, username: 'newuser', role: 'player' },
      accessToken: 'acc-token',
      refreshToken: 'ref-token',
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'newuser', password: 'Pass1234' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.username).toBe('newuser');
    expect(res.body.data.accessToken).toBe('acc-token');
  });

  it('service hata fırlatırsa → hata döner', async () => {
    const { ConflictError } = require('../../server/utils/errors');
    authService.register.mockRejectedValue(new ConflictError('Bu kullanıcı adı zaten alınmış'));

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'existing', password: 'Pass1234' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/guest', () => {
  it('başarılı misafir girişi → 201', async () => {
    authService.guestLogin.mockResolvedValue({
      user: { id: 99, username: 'misafir_ABC123', display_name: 'Oyuncu', role: 'guest' },
      accessToken: 'guest-token',
    });

    const res = await request(app)
      .post('/api/auth/guest')
      .send({ nickname: 'Oyuncu' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('guest');
    expect(res.body.data.accessToken).toBe('guest-token');
    expect(res.body.data.refreshToken).toBeUndefined();
  });

  it('geçersiz takma ad → hata', async () => {
    const { BadRequestError } = require('../../server/utils/errors');
    authService.guestLogin.mockRejectedValue(new BadRequestError('Takma ad 3-15 karakter arasında olmalıdır'));

    const res = await request(app)
      .post('/api/auth/guest')
      .send({ nickname: 'ab' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/login', () => {
  it('başarılı giriş → 200', async () => {
    authService.login.mockResolvedValue({
      user: { id: 1, username: 'testuser', role: 'player' },
      accessToken: 'acc-token',
      refreshToken: 'ref-token',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'Pass1234' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBe('acc-token');
  });

  it('yanlış şifre → hata', async () => {
    const { UnauthorizedError } = require('../../server/utils/errors');
    authService.login.mockRejectedValue(new UnauthorizedError('Geçersiz kullanıcı adı veya şifre'));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/refresh', () => {
  it('başarılı token yenileme → 200', async () => {
    authService.refreshToken.mockResolvedValue({
      user: { id: 1, username: 'testuser' },
      accessToken: 'new-acc',
      refreshToken: 'new-ref',
    });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'old-ref-token' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('new-acc');
  });
});

describe('POST /api/auth/logout', () => {
  it('token ile çıkış → 200', async () => {
    usersQueries.findById.mockResolvedValue({ id: 1, username: 'testuser', role: 'player', is_banned: false });
    authService.logout.mockResolvedValue();

    const token = generateToken();
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .send({ refreshToken: 'ref-token' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('token olmadan çıkış → 401', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken: 'ref-token' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('geçerli token ile kullanıcı bilgisi → 200', async () => {
    usersQueries.findById.mockResolvedValue({
      id: 1, username: 'testuser', role: 'player',
      email: null, is_banned: false, password_hash: 'hashed',
    });

    const token = generateToken();
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('testuser');
    // password_hash döndürülmemeli
    expect(res.body.data.password_hash).toBeUndefined();
  });

  it('kullanıcı bulunamazsa → 404', async () => {
    usersQueries.findById.mockResolvedValue(null);

    const token = generateToken();
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
