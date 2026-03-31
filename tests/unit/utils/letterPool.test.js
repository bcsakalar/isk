const { TURKISH_LETTERS, EASY_LETTERS, HARD_LETTERS, pickRandomLetter } = require('../../../server/utils/letterPool');

describe('letterPool sabitleri', () => {
  it('TURKISH_LETTERS 28 harf içermeli', () => {
    expect(TURKISH_LETTERS).toHaveLength(28);
  });

  it('EASY_LETTERS 21 harf içermeli', () => {
    expect(EASY_LETTERS).toHaveLength(21);
  });

  it('HARD_LETTERS 7 harf içermeli', () => {
    expect(HARD_LETTERS).toHaveLength(7);
  });

  it('Q, W, X, Ğ harflerini içermemeli', () => {
    expect(TURKISH_LETTERS).not.toContain('Q');
    expect(TURKISH_LETTERS).not.toContain('W');
    expect(TURKISH_LETTERS).not.toContain('X');
    expect(TURKISH_LETTERS).not.toContain('Ğ');
  });

  it('Türkçe özel harfleri içermeli', () => {
    for (const letter of ['Ç', 'İ', 'Ö', 'Ş', 'Ü']) {
      expect(TURKISH_LETTERS).toContain(letter);
    }
  });

  it('zor harfler TURKISH_LETTERS içinde olmalı', () => {
    for (const letter of HARD_LETTERS) {
      expect(TURKISH_LETTERS).toContain(letter);
    }
  });
});

describe('pickRandomLetter', () => {
  it('boş usedLetters ile bir harf döndürmeli', () => {
    const letter = pickRandomLetter([]);
    expect(letter).toBeDefined();
    expect(TURKISH_LETTERS).toContain(letter);
  });

  it('kullanılmış harfleri hariç tutmalı', () => {
    const used = ['A', 'B', 'C'];
    for (let i = 0; i < 20; i++) {
      const letter = pickRandomLetter(used);
      expect(used).not.toContain(letter);
    }
  });

  it('enabledLetters ile sadece o harflerden seçmeli', () => {
    const enabled = 'A,B,C';
    for (let i = 0; i < 30; i++) {
      const letter = pickRandomLetter([], enabled);
      expect(['A', 'B', 'C']).toContain(letter);
    }
  });

  it('enabledLetters olmadan tüm havuzdan seçmeli', () => {
    const results = new Set();
    for (let i = 0; i < 200; i++) {
      results.add(pickRandomLetter([]));
    }
    // En az bir zor harf gelmiş olmalı (istatistiksel olarak neredeyse kesin)
    const hasHard = HARD_LETTERS.some(h => results.has(h));
    expect(hasHard).toBe(true);
  });

  it('tüm harfler kullanılmışsa yine de bir harf döndürmeli', () => {
    const letter = pickRandomLetter([...TURKISH_LETTERS]);
    expect(letter).toBeDefined();
    expect(TURKISH_LETTERS).toContain(letter);
  });

  it('geçersiz enabledLetters ile tüm havuza fallback yapmalı', () => {
    const letter = pickRandomLetter([], 'Q,W,X');
    expect(letter).toBeDefined();
    expect(TURKISH_LETTERS).toContain(letter);
  });
});
