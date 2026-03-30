const jwt = require('jsonwebtoken');

jest.mock('../../../server/db/queries/users.queries');
const usersQueries = require('../../../server/db/queries/users.queries');
const { authenticateToken, checkBan, optionalAuth, denyGuests } = require('../../../server/middleware/auth');
const { getMockUser, getMockGuestUser } = require('../../helpers/factories');

function createMockReqResNext(headers = {}) {
  const req = { headers, user: null };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  return { req, res, next };
}

describe('authenticateToken', () => {
  const secret = process.env.JWT_SECRET || 'test-jwt-secret-for-testing-only';

  it('geçerli Bearer token ile req.user set etmeli ve next çağırmalı', () => {
    const token = jwt.sign({ id: 1, username: 'test', role: 'player', level: 1 }, secret);
    const { req, res, next } = createMockReqResNext({ authorization: `Bearer ${token}` });

    authenticateToken(req, res, next);

    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(1);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeUndefined(); // hata olmadan çağrılmalı
  });

  it('token yoksa UnauthorizedError ile next çağırmalı', () => {
    const { req, res, next } = createMockReqResNext({});

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(401);
  });

  it('geçersiz token ile UnauthorizedError fırlatmalı', () => {
    const { req, res, next } = createMockReqResNext({ authorization: 'Bearer invalid-token' });

    authenticateToken(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Geçersiz token');
  });

  it('süresi dolmuş token ile hata fırlatmalı', () => {
    const token = jwt.sign({ id: 1 }, secret, { expiresIn: '0s' });
    const { req, res, next } = createMockReqResNext({ authorization: `Bearer ${token}` });

    // Token hemen expire olduğu için küçük bir gecikme yok ama sign ile 0s = anında expire
    authenticateToken(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(401);
  });

  it('Bearer prefix olmadan token kabul etmemeli', () => {
    const token = jwt.sign({ id: 1 }, secret);
    const { req, res, next } = createMockReqResNext({ authorization: token });

    authenticateToken(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(401);
  });
});

describe('checkBan', () => {
  it('banlı olmayan kullanıcıda next çağırmalı', async () => {
    const user = getMockUser({ is_banned: false });
    usersQueries.findById.mockResolvedValue(user);
    const { req, res, next } = createMockReqResNext();
    req.user = { id: user.id };

    await checkBan(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('banlı kullanıcıda UnauthorizedError döndürmeli', async () => {
    usersQueries.findById.mockResolvedValue(getMockUser({ is_banned: true, ban_reason: 'Spam' }));
    const { req, res, next } = createMockReqResNext();
    req.user = { id: 1 };

    await checkBan(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(401);
  });

  it('bulunamayan kullanıcıda hata fırlatmalı', async () => {
    usersQueries.findById.mockResolvedValue(null);
    const { req, res, next } = createMockReqResNext();
    req.user = { id: 999 };

    await checkBan(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(401);
  });
});

describe('optionalAuth', () => {
  const secret = process.env.JWT_SECRET || 'test-jwt-secret-for-testing-only';

  it('geçerli token ile req.user set etmeli', () => {
    const token = jwt.sign({ id: 1, username: 'test' }, secret);
    const { req, res, next } = createMockReqResNext({ authorization: `Bearer ${token}` });

    optionalAuth(req, res, next);

    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(1);
    expect(next).toHaveBeenCalled();
  });

  it('token olmadan sessizce devam etmeli', () => {
    const { req, res, next } = createMockReqResNext({});

    optionalAuth(req, res, next);

    expect(req.user).toBeFalsy();
    expect(next).toHaveBeenCalled();
  });

  it('geçersiz token ile hata fırlatmadan devam etmeli', () => {
    const { req, res, next } = createMockReqResNext({ authorization: 'Bearer invalid' });

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeUndefined();
  });
});

describe('denyGuests', () => {
  it('misafir kullanıcıda ForbiddenError fırlatmalı', () => {
    const { req, res, next } = createMockReqResNext();
    req.user = { id: 1, username: 'misafir_ABC123', role: 'guest' };

    denyGuests(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
  });

  it('normal kullanıcıda next çağırmalı', () => {
    const { req, res, next } = createMockReqResNext();
    req.user = { id: 1, username: 'testuser', role: 'player' };

    denyGuests(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('admin kullanıcıda next çağırmalı', () => {
    const { req, res, next } = createMockReqResNext();
    req.user = { id: 1, username: 'admin', role: 'admin' };

    denyGuests(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeUndefined();
  });
});
