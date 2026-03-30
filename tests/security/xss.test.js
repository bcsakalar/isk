const { sanitizeString, sanitizeInput } = require('../../server/middleware/sanitizer');

describe('XSS Güvenlik Testleri', () => {
  describe('Script injection', () => {
    const payloads = [
      '<script>alert("XSS")</script>',
      '<script src="evil.js"></script>',
      '<SCRIPT>alert(1)</SCRIPT>',
      '<scr<script>ipt>alert(1)</script>',
    ];

    payloads.forEach((payload) => {
      it(`engellenmeli: ${payload.substring(0, 40)}...`, () => {
        const result = sanitizeString(payload);
        expect(result.toLowerCase()).not.toContain('<script');
      });
    });
  });

  describe('Event handler injection', () => {
    const payloads = [
      '<img src=x onerror=alert(1)>',
      '<div onmouseover="evil()">test</div>',
      '<body onload=alert(1)>',
      '<input onfocus=alert(1) autofocus>',
      '<a onmouseenter="alert(1)">link</a>',
    ];

    payloads.forEach((payload) => {
      it(`engellenmeli: ${payload.substring(0, 40)}...`, () => {
        const result = sanitizeString(payload);
        expect(result).not.toMatch(/on\w+\s*=/i);
      });
    });
  });

  describe('HTML injection', () => {
    const payloads = [
      '<iframe src="evil.com"></iframe>',
      '<embed src="evil.swf">',
      '<object data="evil.swf"></object>',
      '<form action="evil.com"><input></form>',
      '<link rel="import" href="evil.html">',
    ];

    payloads.forEach((payload) => {
      it(`engellenmeli: ${payload.substring(0, 40)}...`, () => {
        const result = sanitizeString(payload);
        expect(result).not.toMatch(/<(iframe|embed|object|form|link)/i);
      });
    });
  });

  describe('SVG/MathML injection', () => {
    const payloads = [
      '<svg onload=alert(1)>',
      '<svg><script>alert(1)</script></svg>',
      '<math><mi>test</mi></math>',
    ];

    payloads.forEach((payload) => {
      it(`engellenmeli: ${payload.substring(0, 40)}...`, () => {
        const result = sanitizeString(payload);
        expect(result).not.toMatch(/<(svg|math)/i);
      });
    });
  });

  describe('JavaScript URL injection', () => {
    it('javascript: URL engellenmeli', () => {
      // sanitizeString sadece tag'leri temizler, URL'leri değil
      // Ancak tag içindeki href ile gelen javascript: engellenir
      const result = sanitizeString('<a href="javascript:alert(1)">click</a>');
      expect(result).not.toContain('javascript:');
    });
  });

  describe('Encoding bypass denemeleri', () => {
    it('HTML entity ile bypass engellenmeli', () => {
      const result = sanitizeString('&#60;script&#62;alert(1)&#60;/script&#62;');
      expect(result.toLowerCase()).not.toContain('<script');
    });
  });

  describe('Temiz veriler korunmalı', () => {
    it('düz metin değişmemeli', () => {
      expect(sanitizeString('Normal metin')).toBe('Normal metin');
    });

    it('Türkçe karakterler korunmalı', () => {
      expect(sanitizeString('Çağrı Şenöz İğdır Üstelik Ömer')).toBe('Çağrı Şenöz İğdır Üstelik Ömer');
    });

    it('sayı ve semboller korunmalı', () => {
      expect(sanitizeString('Puan: 100 + 50 = 150')).toBe('Puan: 100 + 50 = 150');
    });
  });
});
