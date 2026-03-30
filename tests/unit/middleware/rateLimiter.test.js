const { generalLimiter, authLimiter, registerLimiter, apiLimiter } = require('../../../server/middleware/rateLimiter');

describe('Rate Limiter yapılandırması', () => {
  it('generalLimiter middleware fonksiyonu olmalı', () => {
    expect(typeof generalLimiter).toBe('function');
  });

  it('authLimiter middleware fonksiyonu olmalı', () => {
    expect(typeof authLimiter).toBe('function');
  });

  it('registerLimiter middleware fonksiyonu olmalı', () => {
    expect(typeof registerLimiter).toBe('function');
  });

  it('apiLimiter middleware fonksiyonu olmalı', () => {
    expect(typeof apiLimiter).toBe('function');
  });
});

describe('Rate Limiter entegrasyonu', () => {
  function createReqRes(ip = '127.0.0.1', user = null) {
    const req = {
      ip,
      user,
      headers: {},
      method: 'GET',
      url: '/test',
      on: jest.fn(),
      socket: { remoteAddress: ip },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      set: jest.fn(),
      send: jest.fn(),
      end: jest.fn(),
      headersSent: false,
    };
    const next = jest.fn();
    return { req, res, next };
  }

  it('generalLimiter ilk isteği geçirmeli', (done) => {
    const { req, res, next } = createReqRes('10.0.0.1');

    generalLimiter(req, res, () => {
      done();
    });
  });

  it('authLimiter ilk isteği geçirmeli', (done) => {
    const { req, res, next } = createReqRes('10.0.0.2');

    authLimiter(req, res, () => {
      done();
    });
  });

  it('registerLimiter ilk isteği geçirmeli', (done) => {
    const { req, res, next } = createReqRes('10.0.0.3');

    registerLimiter(req, res, () => {
      done();
    });
  });

  it('apiLimiter ilk isteği geçirmeli', (done) => {
    const { req, res, next } = createReqRes('10.0.0.4');

    apiLimiter(req, res, () => {
      done();
    });
  });

  it('tüm limiter mesajları Türkçe olmalı', () => {
    // rate-limit konfigürasyonları doğrudan erişilemez ama export edilen
    // middleware fonksiyonlarının varlığı ve türü kontrol edilebilir
    // Mesaj içeriğini modül kaynak kodundan doğruluyoruz
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '../../../server/middleware/rateLimiter.js'),
      'utf8'
    );

    expect(source).toContain('Çok fazla istek gönderdiniz');
    expect(source).toContain('Çok fazla giriş denemesi');
    expect(source).toContain('Çok fazla kayıt denemesi');
    expect(source).toContain('API istek limiti aşıldı');
  });
});
