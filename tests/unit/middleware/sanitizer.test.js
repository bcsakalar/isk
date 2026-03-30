const { sanitizeInput, sanitizeString } = require('../../../server/middleware/sanitizer');

describe('sanitizeString', () => {
  it('normal text\'e dokunmamalı', () => {
    expect(sanitizeString('Merhaba Dünya')).toBe('Merhaba Dünya');
  });

  it('<script> taglerini temizlemeli', () => {
    const result = sanitizeString('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
  });

  it('<img onerror> saldırısını temizlemeli', () => {
    const result = sanitizeString('<img src=x onerror=alert(1)>');
    expect(result).not.toContain('<img');
    expect(result).not.toContain('onerror');
  });

  it('event handler attribute\'larını temizlemeli', () => {
    const result = sanitizeString('<div onclick="evil()">test</div>');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('evil');
    expect(result).toContain('test');
  });

  it('SVG XSS payload\'ını temizlemeli', () => {
    const result = sanitizeString('<svg onload=alert(1)>');
    expect(result).not.toContain('<svg');
    expect(result).not.toContain('onload');
  });

  it('string olmayan değere dokunmamalı', () => {
    expect(sanitizeString(42)).toBe(42);
    expect(sanitizeString(null)).toBe(null);
  });

  it('boşlukları trim etmeli', () => {
    expect(sanitizeString('  test  ')).toBe('test');
  });

  it('Türkçe karakterleri korumalı', () => {
    expect(sanitizeString('Çağrı Şenöz İğdır Ünal')).toBe('Çağrı Şenöz İğdır Ünal');
  });
});

describe('sanitizeInput middleware', () => {
  function createReqResNext(body = {}, queryParams = {}, params = {}) {
    const req = { body, query: queryParams, params };
    const res = {};
    const next = jest.fn();
    return { req, res, next };
  }

  it('body\'deki HTML taglerini temizlemeli', () => {
    const { req, res, next } = createReqResNext({ name: '<b>test</b>' });

    sanitizeInput(req, res, next);

    expect(req.body.name).toBe('test');
    expect(next).toHaveBeenCalled();
  });

  it('query params\'daki XSS\'i temizlemeli', () => {
    const { req, res, next } = createReqResNext({}, { search: '<script>evil()</script>' });

    sanitizeInput(req, res, next);

    expect(req.query.search).not.toContain('<script>');
    expect(next).toHaveBeenCalled();
  });

  it('params\'daki XSS\'i temizlemeli', () => {
    const { req, res, next } = createReqResNext({}, {}, { id: '<img onerror=alert(1)>' });

    sanitizeInput(req, res, next);

    expect(req.params.id).not.toContain('<img');
    expect(next).toHaveBeenCalled();
  });

  it('nested object\'leri temizlemeli', () => {
    const { req, res, next } = createReqResNext({
      user: { name: '<script>xss</script>test' },
    });

    sanitizeInput(req, res, next);

    expect(req.body.user.name).not.toContain('<script>');
    expect(req.body.user.name).toContain('test');
  });

  it('number değerlere dokunmamalı', () => {
    const { req, res, next } = createReqResNext({ count: 42, active: true });

    sanitizeInput(req, res, next);

    expect(req.body.count).toBe(42);
    expect(req.body.active).toBe(true);
  });

  it('MAX_DEPTH (10) sınırını aşan derinlikte temizlememeli', () => {
    // 11 seviye derinlikte nested object oluştur
    let nested = { value: '<b>deep</b>' };
    for (let i = 0; i < 11; i++) {
      nested = { inner: nested };
    }
    const { req, res, next } = createReqResNext(nested);

    sanitizeInput(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
