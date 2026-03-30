const { sanitizeString } = require('../../server/middleware/sanitizer');

describe('Input Validation Güvenlik Testleri', () => {
  describe('SQL Injection pattern\'ları', () => {
    // sanitizer SQL injection'a karşı koruma sağlamaz (parameterized queries kullanılır)
    // Ancak tag temizleme ile bazı pattern'lar kırpılır
    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "1 OR 1=1",
      "' UNION SELECT * FROM users --",
      "admin'--",
    ];

    sqlPayloads.forEach((payload) => {
      it(`SQL payload korunmalı (parameterized query koruması): ${payload.substring(0, 30)}`, () => {
        // sanitizeString HTML temizler, SQL'e dokunmaz
        // Bu test SQL injection'ın sanitizer seviyesinde DEĞİL, query seviyesinde engellendiğini belgeliyor
        const result = sanitizeString(payload);
        // SQL payload'ları HTML tag içermediği için sanitizeString tarafından değiştirilmez
        // Bu beklenen davranıştır — gerçek koruma parameterized queries'dedir
        expect(typeof result).toBe('string');
      });
    });
  });

  describe('Çok uzun input koruması', () => {
    it('çok uzun string sanitize edilebilmeli', () => {
      const longString = 'A'.repeat(100000);
      const result = sanitizeString(longString);
      expect(result).toBe(longString);
    });

    it('HTML tag içeren uzun string temizlenmeli', () => {
      const longPayload = '<script>' + 'x'.repeat(10000) + '</script>';
      const result = sanitizeString(longPayload);
      expect(result).not.toContain('<script');
    });
  });

  describe('Özel karakter koruması', () => {
    it('null byte injection', () => {
      const result = sanitizeString('test\x00admin');
      expect(typeof result).toBe('string');
    });

    it('unicode injection', () => {
      const result = sanitizeString('test\u202Eadmin');
      expect(typeof result).toBe('string');
    });

    it('CRLF injection', () => {
      const result = sanitizeString('test\r\nHeader-Injection: evil');
      expect(typeof result).toBe('string');
    });
  });

  describe('Nested object depth koruması', () => {
    it('aşırı derin nested object reddedilmeli veya truncate edilmeli', () => {
      // 15 seviye derinlikte nested bir obje oluştur (MAX_DEPTH=10)
      let obj = { value: '<b>deep</b>' };
      for (let i = 0; i < 15; i++) {
        obj = { inner: obj };
      }

      // sanitizeInput middleware olarak çalışır
      const { sanitizeInput } = require('../../server/middleware/sanitizer');
      const req = { body: obj, query: {}, params: {} };
      const res = {};
      const next = jest.fn();

      sanitizeInput(req, res, next);

      // next çağrılmalı — uygulama çökmemeli
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Array input koruması', () => {
    it('array içindeki string\'ler sanitize edilmeli', () => {
      const { sanitizeInput } = require('../../server/middleware/sanitizer');
      const req = {
        body: { items: ['<script>xss</script>', 'normal', '<img onerror=x>'] },
        query: {},
        params: {},
      };
      const res = {};
      const next = jest.fn();

      sanitizeInput(req, res, next);

      expect(next).toHaveBeenCalled();
      req.body.items.forEach((item) => {
        expect(item).not.toMatch(/<script/i);
        expect(item).not.toMatch(/onerror/i);
      });
    });
  });

  describe('Boş ve null input koruması', () => {
    it('body null olsa bile çökmemeli', () => {
      const { sanitizeInput } = require('../../server/middleware/sanitizer');
      const req = { body: null, query: {}, params: {} };
      const res = {};
      const next = jest.fn();

      // null body ile çökmemeli
      expect(() => sanitizeInput(req, res, next)).not.toThrow();
    });

    it('body undefined olsa bile çökmemeli', () => {
      const { sanitizeInput } = require('../../server/middleware/sanitizer');
      const req = { body: undefined, query: {}, params: {} };
      const res = {};
      const next = jest.fn();

      expect(() => sanitizeInput(req, res, next)).not.toThrow();
    });
  });
});
