const {
  sanitizePayload,
  validateChatMessage,
  validateAnswers,
  validateRoomCode,
  validatePositiveInt,
  validateVoteType,
  validateBoolean,
  validateRoomSettings,
} = require('../../../server/socket/middleware/socketSanitizer');

// Not: Bu fonksiyonlar başarıda temizlenmiş veriyi, başarısızlıkta null döndürür.

describe('sanitizePayload', () => {
  it('string değerleri trim etmeli', () => {
    const result = sanitizePayload({ name: '  test  ' });
    expect(result.name).toBe('test');
  });

  it('script tag\'lerini temizlemeli', () => {
    const result = sanitizePayload({ msg: '<script>alert("xss")</script>hello' });
    expect(result.msg).not.toContain('<script>');
    expect(result.msg).toContain('hello');
  });

  it('çok uzun stringleri kesmeli', () => {
    const longStr = 'a'.repeat(2000);
    const result = sanitizePayload({ text: longStr });
    expect(result.text.length).toBeLessThanOrEqual(500);
  });

  it('iç içe nesneleri temizlemeli', () => {
    const result = sanitizePayload({ a: { b: ' test ' } });
    expect(result.a.b).toBe('test');
  });

  it('derin iç içe yapıda maxDepth sınırında derinleşmeyi durdurmalı', () => {
    // maxDepth=5: a(4) > b(3) > c(2) > d(1) > e(0) → e seviyesinde obje olarak bırakır
    const deep = { a: { b: { c: { d: { e: { f: 'too deep' } } } } } };
    const result = sanitizePayload(deep);
    // depth=0'da objeyi olduğu gibi bırakır (sanitize etmez)
    expect(result.a.b.c.d.e).toEqual({ f: 'too deep' });
  });

  it('sayı ve boolean değerlere dokunmamalı', () => {
    const result = sanitizePayload({ num: 42, bool: true });
    expect(result.num).toBe(42);
    expect(result.bool).toBe(true);
  });

  it('null/undefined input → olduğu gibi döndürmeli', () => {
    expect(sanitizePayload(null)).toBeNull();
    expect(sanitizePayload(undefined)).toBeUndefined();
  });
});

describe('validateChatMessage', () => {
  it('geçerli mesajı temizlenmiş olarak döndürmeli', () => {
    const result = validateChatMessage('Merhaba!');
    expect(result).toBe('Merhaba!');
  });

  it('boş mesajda null döndürmeli', () => {
    const result = validateChatMessage('');
    expect(result).toBeNull();
  });

  it('500 karakterden uzun mesajda null döndürmeli', () => {
    const result = validateChatMessage('a'.repeat(501));
    expect(result).toBeNull();
  });

  it('string olmayan değerde null döndürmeli', () => {
    const result = validateChatMessage(123);
    expect(result).toBeNull();
  });
});

describe('validateAnswers', () => {
  it('geçerli cevap objesini temizlenmiş olarak döndürmeli', () => {
    const result = validateAnswers({ isim: 'Ali', sehir: 'Ankara' });
    expect(result).toEqual({ isim: 'Ali', sehir: 'Ankara' });
  });

  it('null cevabında null döndürmeli', () => {
    const result = validateAnswers(null);
    expect(result).toBeNull();
  });

  it('uzun cevabı keserek döndürmeli', () => {
    const result = validateAnswers({ isim: 'a'.repeat(201) });
    expect(result).toBeTruthy();
    expect(result.isim.length).toBeLessThanOrEqual(100);
  });

  it('20\'den fazla kategoride null döndürmeli', () => {
    const answers = {};
    for (let i = 0; i < 21; i++) answers[`cat${i}`] = 'test';
    const result = validateAnswers(answers);
    expect(result).toBeNull();
  });
});

describe('validateRoomCode', () => {
  it('geçerli kodu temizlenmiş olarak döndürmeli', () => {
    expect(validateRoomCode('ABC123')).toBe('ABC123');
  });

  it('uzun kodda null döndürmeli', () => {
    expect(validateRoomCode('A'.repeat(21))).toBeNull();
  });

  it('string olmayan değerde null döndürmeli', () => {
    expect(validateRoomCode(123)).toBeNull();
  });
});

describe('validatePositiveInt', () => {
  it('pozitif sayıyı döndürmeli', () => {
    expect(validatePositiveInt(5)).toBe(5);
  });

  it('negatif sayıda null döndürmeli', () => {
    expect(validatePositiveInt(-1)).toBeNull();
  });

  it('float sayıda null döndürmeli', () => {
    expect(validatePositiveInt(3.5)).toBeNull();
  });
});

describe('validateVoteType', () => {
  it('positive kabul etmeli', () => {
    expect(validateVoteType('positive')).toBe('positive');
  });

  it('negative kabul etmeli', () => {
    expect(validateVoteType('negative')).toBe('negative');
  });

  it('geçersiz tipte null döndürmeli', () => {
    expect(validateVoteType('invalid')).toBeNull();
  });
});

describe('validateBoolean', () => {
  it('true döndürmeli', () => {
    expect(validateBoolean(true)).toBe(true);
  });

  it('false döndürmeli', () => {
    expect(validateBoolean(false)).toBe(false);
  });

  it('string değerde null döndürmeli', () => {
    expect(validateBoolean('true')).toBeNull();
  });
});

describe('validateRoomSettings', () => {
  it('geçerli ayarları temizlenmiş olarak döndürmeli', () => {
    const result = validateRoomSettings({ maxPlayers: 6, timePerRound: 60 });
    expect(result).toEqual({ maxPlayers: 6, timePerRound: 60 });
  });

  it('bilinmeyen anahtarı filtrelemeli', () => {
    const result = validateRoomSettings({ hackerField: 'value' });
    expect(result).toEqual({});
  });

  it('null ayarlarda null döndürmeli', () => {
    const result = validateRoomSettings(null);
    expect(result).toBeNull();
  });
});
