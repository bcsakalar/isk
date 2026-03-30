const { ForbiddenError } = require('../../../server/utils/errors');

// adminGuard ve moderatorGuard'ı require et
const { adminGuard, moderatorGuard } = require('../../../server/middleware/adminGuard');

function createReqResNext(role = 'player') {
  const req = { user: { id: 1, username: 'testuser', role } };
  const res = {};
  const next = jest.fn();
  return { req, res, next };
}

describe('adminGuard', () => {
  it('admin kullanıcıyı geçirmeli', () => {
    const { req, res, next } = createReqResNext('admin');

    adminGuard(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('player kullanıcıyı engellemeli (403)', () => {
    const { req, res, next } = createReqResNext('player');

    adminGuard(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('moderator kullanıcıyı engellemeli (403)', () => {
    const { req, res, next } = createReqResNext('moderator');

    adminGuard(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});

describe('moderatorGuard', () => {
  it('admin kullanıcıyı geçirmeli', () => {
    const { req, res, next } = createReqResNext('admin');

    moderatorGuard(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('moderator kullanıcıyı geçirmeli', () => {
    const { req, res, next } = createReqResNext('moderator');

    moderatorGuard(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('player kullanıcıyı engellemeli (403)', () => {
    const { req, res, next } = createReqResNext('player');

    moderatorGuard(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
