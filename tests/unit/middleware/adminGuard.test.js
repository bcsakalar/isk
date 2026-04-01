const { ForbiddenError } = require('../../../server/utils/errors');

jest.mock('../../../server/db/queries/users.queries');
const usersQueries = require('../../../server/db/queries/users.queries');

// adminGuard ve moderatorGuard'ı require et
const { adminGuard, moderatorGuard } = require('../../../server/middleware/adminGuard');

function createReqResNext(role = 'player') {
  const req = { user: { id: 1, username: 'testuser', role } };
  const res = {};
  const next = jest.fn();
  return { req, res, next };
}

beforeEach(() => {
  usersQueries.findById.mockReset();
});

describe('adminGuard', () => {
  it('admin kullanıcıyı geçirmeli', async () => {
    const { req, res, next } = createReqResNext('admin');
    usersQueries.findById.mockResolvedValue({ id: 1, username: 'testuser', role: 'admin' });

    await adminGuard(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('player kullanıcıyı engellemeli (403)', async () => {
    const { req, res, next } = createReqResNext('player');
    usersQueries.findById.mockResolvedValue({ id: 1, username: 'testuser', role: 'player' });

    await adminGuard(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('moderator kullanıcıyı engellemeli (403)', async () => {
    const { req, res, next } = createReqResNext('moderator');
    usersQueries.findById.mockResolvedValue({ id: 1, username: 'testuser', role: 'moderator' });

    await adminGuard(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('JWT admin ama DB player → engellemeli (privilege escalation)', async () => {
    const { req, res, next } = createReqResNext('admin');
    usersQueries.findById.mockResolvedValue({ id: 1, username: 'testuser', role: 'player' });

    await adminGuard(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('DB kullanıcı bulunamadığında engellemeli', async () => {
    const { req, res, next } = createReqResNext('admin');
    usersQueries.findById.mockResolvedValue(null);

    await adminGuard(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});

describe('moderatorGuard', () => {
  it('admin kullanıcıyı geçirmeli', async () => {
    const { req, res, next } = createReqResNext('admin');
    usersQueries.findById.mockResolvedValue({ id: 1, username: 'testuser', role: 'admin' });

    await moderatorGuard(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('moderator kullanıcıyı geçirmeli', async () => {
    const { req, res, next } = createReqResNext('moderator');
    usersQueries.findById.mockResolvedValue({ id: 1, username: 'testuser', role: 'moderator' });

    await moderatorGuard(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('player kullanıcıyı engellemeli (403)', async () => {
    const { req, res, next } = createReqResNext('player');
    usersQueries.findById.mockResolvedValue({ id: 1, username: 'testuser', role: 'player' });

    await moderatorGuard(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
