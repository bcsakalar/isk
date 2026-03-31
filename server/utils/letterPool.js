// Türkçe harf havuzu — Q, W, X, Ğ hariç (Ğ ile başlayan kelime yok denecek kadar az)
const TURKISH_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
  'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
  'R', 'S', 'T', 'U', 'V', 'Y', 'Z',
  'Ç', 'İ', 'Ö', 'Ş', 'Ü'
];

const EASY_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
  'I', 'K', 'L', 'M', 'N', 'O', 'P',
  'R', 'S', 'T', 'U', 'Y', 'Z'
];

const HARD_LETTERS = ['Ç', 'İ', 'J', 'Ö', 'Ş', 'Ü', 'V'];

/**
 * @param {string[]} usedLetters - Daha önce kullanılan harfler
 * @param {string|null} enabledLetters - Virgülle ayrılmış aktif harfler, null ise tüm havuz
 */
function pickRandomLetter(usedLetters = [], enabledLetters = null) {
  let pool;
  if (enabledLetters) {
    pool = enabledLetters.split(',').map(l => l.trim().toLocaleUpperCase('tr-TR')).filter(l => TURKISH_LETTERS.includes(l));
    if (pool.length === 0) pool = [...TURKISH_LETTERS];
  } else {
    pool = [...TURKISH_LETTERS];
  }
  const available = pool.filter(l => !usedLetters.includes(l));
  if (available.length === 0) return pool[Math.floor(Math.random() * pool.length)];
  return available[Math.floor(Math.random() * available.length)];
}

module.exports = { TURKISH_LETTERS, EASY_LETTERS, HARD_LETTERS, pickRandomLetter };
