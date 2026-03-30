jest.mock('../../../server/db/queries/users.queries');
jest.mock('../../../server/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const usersQueries = require('../../../server/db/queries/users.queries');
const { query } = require('../../../server/config/database');
const { getMockUser, getMockGuestUser } = require('../../helpers/factories');

// authService'i env yüklendikten sonra import et
let authService;
beforeAll(() => {
  authService = require('../../../server/services/auth.service');
});

describe('authService.register', () => {
  beforeEach(() => {
    usersQueries.findByUsername.mockResolvedValue(null);
    usersQueries.create.mockResolvedValue({ id: 1, username: 'testuser', email: null, display_name: 'testuser', role: 'player', xp: 0, level: 1 });
    query.mockResolvedValue({ rows: [] });
  });

  it('geçerli bilgilerle kullanıcı oluşturmalı', async () => {
    const result = await authService.register({
      username: 'testuser',
      password: 'Test1234!',
    });

    expect(result.user).toBeDefined();
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(usersQueries.create).toHaveBeenCalled();
  });

  it('eksik alanlarla BadRequestError fırlatmalı', async () => {
    await expect(authService.register({ username: '', password: '' }))
      .rejects.toThrow('Kullanıcı adı ve şifre zorunludur');
  });

  it('3 karakterden kısa kullanıcı adını reddetmeli', async () => {
    await expect(authService.register({ username: 'ab', password: 'Test1234!' }))
      .rejects.toThrow('Kullanıcı adı 3-20 karakter arasında olmalıdır');
  });

  it('20 karakterden uzun kullanıcı adını reddetmeli', async () => {
    await expect(authService.register({ username: 'a'.repeat(21), password: 'Test1234!' }))
      .rejects.toThrow('Kullanıcı adı 3-20 karakter arasında olmalıdır');
  });

  it('geçersiz karakterli kullanıcı adını reddetmeli', async () => {
    await expect(authService.register({ username: 'test user!', password: 'Test1234!' }))
      .rejects.toThrow('Kullanıcı adı sadece harf, rakam ve _ içerebilir');
  });

  it('8 karakterden kısa şifreyi reddetmeli', async () => {
    await expect(authService.register({ username: 'testuser', password: '1234567' }))
      .rejects.toThrow('Şifre en az 8 karakter olmalıdır');
  });

  it('mevcut kullanıcı adı ile ConflictError fırlatmalı', async () => {
    usersQueries.findByUsername.mockResolvedValue(getMockUser());
    await expect(authService.register({ username: 'testuser', password: 'Test1234!' }))
      .rejects.toThrow('Bu kullanıcı adı zaten kullanılıyor');
  });
});

describe('authService.login', () => {
  const mockUser = getMockUser({ id: 1, username: 'testuser', password_hash: '$2b$12$test' });

  beforeEach(() => {
    usersQueries.findByUsername.mockResolvedValue(null);
    usersQueries.updateLastLogin.mockResolvedValue();
    query.mockResolvedValue({ rows: [] });
  });

  it('eksik alanlarla BadRequestError fırlatmalı', async () => {
    await expect(authService.login({ username: '', password: '' }))
      .rejects.toThrow('Kullanıcı adı ve şifre zorunludur');
  });

  it('olmayan kullanıcı ile UnauthorizedError fırlatmalı', async () => {
    await expect(authService.login({ username: 'nouser', password: 'Test1234!' }))
      .rejects.toThrow('Geçersiz kullanıcı adı veya şifre');
  });

  it('banlı kullanıcıyı reddetmeli', async () => {
    usersQueries.findByUsername.mockResolvedValue(getMockUser({ is_banned: true }));
    await expect(authService.login({ username: 'banned', password: 'Test1234!' }))
      .rejects.toThrow('Geçersiz kullanıcı adı veya şifre');
  });

  it('misafir kullanıcıyı reddetmeli', async () => {
    usersQueries.findByUsername.mockResolvedValue(getMockGuestUser());
    await expect(authService.login({ username: 'misafir_ABC123', password: 'Test1234!' }))
      .rejects.toThrow('Geçersiz kullanıcı adı veya şifre');
  });

  it('yanlış şifre ile UnauthorizedError fırlatmalı', async () => {
    usersQueries.findByUsername.mockResolvedValue(mockUser);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);
    await expect(authService.login({ username: 'testuser', password: 'wrong' }))
      .rejects.toThrow('Geçersiz kullanıcı adı veya şifre');
  });

  it('doğru bilgilerle token döndürmeli', async () => {
    usersQueries.findByUsername.mockResolvedValue(mockUser);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
    const result = await authService.login({ username: 'testuser', password: 'Test1234!' });
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.user.id).toBe(mockUser.id);
  });
});

describe('authService.guestLogin', () => {
  beforeEach(() => {
    usersQueries.createGuest.mockResolvedValue({
      id: 99,
      username: 'misafir_ABC123',
      display_name: 'Oyuncu',
      role: 'guest',
      is_guest: true,
    });
  });

  it('geçerli takma ad ile misafir oluşturmalı', async () => {
    const result = await authService.guestLogin({ nickname: 'Oyuncu' });
    expect(result.user).toBeDefined();
    expect(result.accessToken).toBeDefined();
    expect(result.user.role).toBe('guest');
    expect(usersQueries.createGuest).toHaveBeenCalled();
  });

  it('refresh token döndürmemeli', async () => {
    const result = await authService.guestLogin({ nickname: 'Oyuncu' });
    expect(result.refreshToken).toBeUndefined();
  });

  it('3 karakterden kısa takma adı reddetmeli', async () => {
    await expect(authService.guestLogin({ nickname: 'ab' }))
      .rejects.toThrow('Takma ad 3-15 karakter arasında olmalıdır');
  });

  it('15 karakterden uzun takma adı reddetmeli', async () => {
    await expect(authService.guestLogin({ nickname: 'a'.repeat(16) }))
      .rejects.toThrow('Takma ad 3-15 karakter arasında olmalıdır');
  });

  it('boş takma adı reddetmeli', async () => {
    await expect(authService.guestLogin({ nickname: '' }))
      .rejects.toThrow('Takma ad 3-15 karakter arasında olmalıdır');
  });

  it('geçersiz karakterli takma adı reddetmeli', async () => {
    await expect(authService.guestLogin({ nickname: 'test user!' }))
      .rejects.toThrow('Takma ad sadece harf, rakam ve _ içerebilir');
  });

  it('Türkçe karakterli takma adı kabul etmeli', async () => {
    const result = await authService.guestLogin({ nickname: 'Şükrü' });
    expect(result.user).toBeDefined();
  });
});

describe('authService.logout', () => {
  it('refresh token ile session silmeli', async () => {
    query.mockResolvedValue({ rows: [] });
    await authService.logout('some-refresh-token');
    expect(query).toHaveBeenCalled();
  });

  it('refresh token olmadan hata fırlatmamalı', async () => {
    await expect(authService.logout(null)).resolves.not.toThrow();
  });
});

describe('authService.register — password policy', () => {
  beforeEach(() => {
    usersQueries.findByUsername.mockResolvedValue(null);
    usersQueries.create.mockResolvedValue({ id: 1, username: 'testuser', role: 'player' });
    query.mockResolvedValue({ rows: [] });
  });

  it('büyük harf içermeyen şifreyi reddetmeli', async () => {
    await expect(authService.register({ username: 'testuser', password: 'test1234' }))
      .rejects.toThrow('Şifre en az bir büyük harf içermelidir');
  });

  it('rakam içermeyen şifreyi reddetmeli', async () => {
    await expect(authService.register({ username: 'testuser', password: 'Testtest' }))
      .rejects.toThrow('Şifre en az bir rakam içermelidir');
  });

  it('kurallara uygun şifreyi kabul etmeli', async () => {
    const result = await authService.register({ username: 'testuser', password: 'Test1234' });
    expect(result.user).toBeDefined();
  });
});

describe('authService.login — account lockout', () => {
  const mockUser = getMockUser({
    id: 1,
    username: 'testuser',
    password_hash: '$2b$12$LJ3m4ys3Lg3WKgWwGBbPXeRYczONXuGi0Mf9g.Xq0C5A.TJY8HK6i',
  });

  beforeEach(() => {
    query.mockResolvedValue({ rows: [] });
    usersQueries.updateLastLogin.mockResolvedValue();
    usersQueries.incrementFailedLogin.mockResolvedValue();
    usersQueries.lockAccount.mockResolvedValue();
    usersQueries.resetFailedLogin.mockResolvedValue();
    usersQueries.getFailedLoginAttempts.mockResolvedValue({ failed_login_attempts: 0, locked_until: null });
  });

  it('kilitli hesabı reddetmeli', async () => {
    const lockedUser = getMockUser({
      locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    usersQueries.findByUsername.mockResolvedValue(lockedUser);

    await expect(authService.login({ username: 'lockeduser', password: 'Test1234!' }))
      .rejects.toThrow('Hesabınız geçici olarak kilitlendi');
  });

  it('süresi dolmuş kilidi olan hesaba izin vermeli', async () => {
    const expiredLockUser = getMockUser({
      locked_until: new Date(Date.now() - 1000).toISOString(),
    });
    usersQueries.findByUsername.mockResolvedValue(expiredLockUser);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    const result = await authService.login({ username: 'testuser', password: 'Test1234!' });
    expect(result.accessToken).toBeDefined();
  });
});
