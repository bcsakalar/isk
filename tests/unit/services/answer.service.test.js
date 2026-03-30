jest.mock('../../../server/middleware/sanitizer', () => ({
  sanitizeString: jest.fn(str => {
    if (typeof str !== 'string') return str;
    return str.replace(/<[^>]*>/g, '').trim();
  }),
}));

const answerService = require('../../../server/services/answer.service');

describe('answerService.validateAnswer', () => {
  it('geçerli cevabı kabul etmeli', () => {
    const result = answerService.validateAnswer('Ankara', 'A');
    expect(result.valid).toBe(true);
    expect(result.cleaned).toBe('Ankara');
  });

  it('boş cevabı reddetmeli', () => {
    const result = answerService.validateAnswer('', 'A');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('empty');
  });

  it('null cevabı reddetmeli', () => {
    const result = answerService.validateAnswer(null, 'A');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('empty');
  });

  it('undefined cevabı reddetmeli', () => {
    const result = answerService.validateAnswer(undefined, 'A');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('empty');
  });

  it('100 karakterden uzun cevabı reddetmeli', () => {
    const longAnswer = 'A' + 'x'.repeat(100);
    const result = answerService.validateAnswer(longAnswer, 'A');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('too_long');
  });

  it('yanlış harfle başlayan cevabı reddetmeli', () => {
    const result = answerService.validateAnswer('Berlin', 'A');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('wrong_letter');
  });

  it('küçük harfle başlayan doğru cevabı kabul etmeli (Türkçe locale)', () => {
    const result = answerService.validateAnswer('ankara', 'A');
    expect(result.valid).toBe(true);
  });

  it('Türkçe İ harfi ile başlayan cevabı doğrulamalı', () => {
    const result = answerService.validateAnswer('İstanbul', 'İ');
    expect(result.valid).toBe(true);
  });

  it('Türkçe Ç harfi ile başlayan cevabı doğrulamalı', () => {
    const result = answerService.validateAnswer('Çanakkale', 'Ç');
    expect(result.valid).toBe(true);
  });

  it('Türkçe Ş harfi ile başlayan cevabı doğrulamalı', () => {
    const result = answerService.validateAnswer('Şanlıurfa', 'Ş');
    expect(result.valid).toBe(true);
  });
});

describe('answerService.compareAnswers', () => {
  it('aynı cevapları eşleştirmeli', () => {
    expect(answerService.compareAnswers('Ankara', 'Ankara')).toBe(true);
  });

  it('case-insensitive karşılaştırmalı', () => {
    expect(answerService.compareAnswers('ankara', 'ANKARA')).toBe(true);
  });

  it('boşluk farklılıklarını normalize etmeli', () => {
    expect(answerService.compareAnswers('  ankara  ', 'ankara')).toBe(true);
  });

  it('farklı cevapları eşleştirmemeli', () => {
    expect(answerService.compareAnswers('Ankara', 'İstanbul')).toBe(false);
  });

  it('null değerlerde false döndürmeli', () => {
    expect(answerService.compareAnswers(null, 'Ankara')).toBe(false);
    expect(answerService.compareAnswers('Ankara', null)).toBe(false);
  });

  it('Türkçe locale ile karşılaştırmalı (İ/i)', () => {
    expect(answerService.compareAnswers('İSTANBUL', 'istanbul')).toBe(true);
  });
});
