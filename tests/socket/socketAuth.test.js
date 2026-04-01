const jwt = require('jsonwebtoken');
const socketAuth = require('../../server/socket/middleware/socketAuth');

const TEST_SECRET = process.env.JWT_SECRET || 'test-secret-key';

function createMockSocket(token, method = 'auth') {
  return {
    handshake: {
      auth: method === 'auth' ? { token } : {},
      query: method === 'query' ? { token } : {},
    },
    user: null,
  };
}

describe('socketAuth middleware', () => {
  it('auth.token ile geçerli token → kullanıcı set edilmeli', (done) => {
    const token = jwt.sign({ id: 1, username: 'testuser', role: 'player' }, TEST_SECRET, { expiresIn: '1h' });
    const socket = createMockSocket(token, 'auth');

    socketAuth(socket, (err) => {
      expect(err).toBeUndefined();
      expect(socket.user).toBeDefined();
      expect(socket.user.id).toBe(1);
      expect(socket.user.username).toBe('testuser');
      done();
    });
  });

  it('query.token artık desteklenmemeli (güvenlik: URL log sızıntısı)', (done) => {
    const token = jwt.sign({ id: 2, username: 'user2', role: 'player' }, TEST_SECRET, { expiresIn: '1h' });
    const socket = createMockSocket(token, 'query');

    socketAuth(socket, (err) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain('token');
      done();
    });
  });

  it('token yoksa → hata', (done) => {
    const socket = createMockSocket(null, 'auth');

    socketAuth(socket, (err) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain('token');
      done();
    });
  });

  it('geçersiz token → hata', (done) => {
    const socket = createMockSocket('invalid-token', 'auth');

    socketAuth(socket, (err) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain('Geçersiz');
      done();
    });
  });

  it('süresi dolmuş token → hata', (done) => {
    const token = jwt.sign({ id: 1, username: 'test' }, TEST_SECRET, { expiresIn: '-1s' });
    const socket = createMockSocket(token, 'auth');

    socketAuth(socket, (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });

  it('farklı secret ile imzalanmış token → hata', (done) => {
    const token = jwt.sign({ id: 1 }, 'wrong-secret', { expiresIn: '1h' });
    const socket = createMockSocket(token, 'auth');

    socketAuth(socket, (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });
});
