const {
  AppError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
} = require('../../../server/utils/errors');

describe('AppError', () => {
  it('varsayılan değerlerle oluşturulmalı', () => {
    const err = new AppError('Test hatası');
    expect(err.message).toBe('Test hatası');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.isOperational).toBe(true);
  });

  it('özel statusCode ve code ile oluşturulmalı', () => {
    const err = new AppError('Özel hata', 418, 'CUSTOM_CODE');
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe('CUSTOM_CODE');
  });

  it('Error sınıfından türemeli', () => {
    const err = new AppError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('NotFoundError', () => {
  it('varsayılan Türkçe mesaj ile 404 döndürmeli', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Kaynak bulunamadı');
    expect(err).toBeInstanceOf(AppError);
  });

  it('özel mesaj kabul etmeli', () => {
    const err = new NotFoundError('Oda bulunamadı');
    expect(err.message).toBe('Oda bulunamadı');
    expect(err.statusCode).toBe(404);
  });
});

describe('BadRequestError', () => {
  it('varsayılan Türkçe mesaj ile 400 döndürmeli', () => {
    const err = new BadRequestError();
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('Geçersiz istek');
  });

  it('özel mesaj kabul etmeli', () => {
    const err = new BadRequestError('Geçersiz oda adı');
    expect(err.message).toBe('Geçersiz oda adı');
  });
});

describe('UnauthorizedError', () => {
  it('varsayılan Türkçe mesaj ile 401 döndürmeli', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Yetkisiz erişim');
  });
});

describe('ForbiddenError', () => {
  it('varsayılan Türkçe mesaj ile 403 döndürmeli', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('Bu işlem için yetkiniz yok');
  });
});

describe('ConflictError', () => {
  it('varsayılan Türkçe mesaj ile 409 döndürmeli', () => {
    const err = new ConflictError();
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('Çakışma hatası');
  });
});

describe('RateLimitError', () => {
  it('varsayılan Türkçe mesaj ile 429 döndürmeli', () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.message).toBe('Çok fazla istek gönderdiniz, lütfen bekleyin');
  });
});
