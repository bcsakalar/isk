const gamesQueries = require('../db/queries/games.queries');
const { sanitizeString } = require('../middleware/sanitizer');
const { BadRequestError } = require('../utils/errors');

const answerService = {
  /**
   * Cevap doğrulaması.
   * - Boşluk kontrolü
   * - Harf kontrolü
   * - Uzunluk kontrolü
   * - Basit tekrar kontrolü
   */
  validateAnswer(answer, letter) {
    if (!answer || typeof answer !== 'string') return { valid: false, reason: 'empty' };

    const clean = sanitizeString(answer).trim();
    if (clean.length === 0) return { valid: false, reason: 'empty' };
    if (clean.length > 100) return { valid: false, reason: 'too_long' };

    const firstChar = clean.charAt(0).toLocaleUpperCase('tr-TR');
    const targetChar = letter.toLocaleUpperCase('tr-TR');

    if (firstChar !== targetChar) {
      return { valid: false, reason: 'wrong_letter' };
    }

    return { valid: true, cleaned: clean };
  },

  /**
   * İki cevabı karşılaştır — Türkçe normalize ederek.
   */
  compareAnswers(a, b) {
    if (!a || !b) return false;
    const normA = a.toLocaleLowerCase('tr-TR').trim().replace(/\s+/g, ' ');
    const normB = b.toLocaleLowerCase('tr-TR').trim().replace(/\s+/g, ' ');
    return normA === normB;
  },
};

module.exports = answerService;
