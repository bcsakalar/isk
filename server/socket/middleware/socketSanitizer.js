const { sanitizeString } = require('../../middleware/sanitizer');
const logger = require('../../utils/logger');

// Socket event payload type/length validasyonu + DOMPurify sanitizasyonu
// Her socket handler'dan önce çağrılır

const MAX_STRING_LENGTH = 500;
const MAX_ANSWER_LENGTH = 100;
const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB base64
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Socket payload'ındaki tüm string alanları sanitize eder
 * @param {object} data - Socket event payload
 * @param {number} maxDepth - Maksimum derinlik
 * @returns {object} Sanitize edilmiş data
 */
function sanitizePayload(data, maxDepth = 5) {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') return sanitizeString(data).slice(0, MAX_STRING_LENGTH);
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    if (data.length > 100) data.length = 100; // Max 100 eleman
    return data.map(item => maxDepth > 0 ? sanitizePayload(item, maxDepth - 1) : item);
  }

  const result = {};
  const keys = Object.keys(data);
  if (keys.length > 50) return {}; // Çok fazla key → şüpheli

  for (const key of keys) {
    const cleanKey = sanitizeString(key).slice(0, 64);
    if (typeof data[key] === 'string') {
      result[cleanKey] = sanitizeString(data[key]).slice(0, MAX_STRING_LENGTH);
    } else if (typeof data[key] === 'object' && data[key] !== null && maxDepth > 0) {
      result[cleanKey] = sanitizePayload(data[key], maxDepth - 1);
    } else {
      result[cleanKey] = data[key];
    }
  }
  return result;
}

/**
 * Chat mesajı validasyonu
 */
function validateChatMessage(message) {
  if (typeof message !== 'string') return null;
  const clean = sanitizeString(message);
  if (clean.length === 0 || clean.length > MAX_STRING_LENGTH) return null;
  return clean;
}

/**
 * Cevap objesi validasyonu (game:submit_answers)
 */
function validateAnswers(answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null;

  const keys = Object.keys(answers);
  if (keys.length === 0 || keys.length > 20) return null;

  const clean = {};
  for (const key of keys) {
    if (typeof answers[key] !== 'string') continue;
    const cleanAnswer = sanitizeString(answers[key]).slice(0, MAX_ANSWER_LENGTH);
    clean[key] = cleanAnswer;
  }
  return clean;
}

/**
 * Görsel yükleme validasyonu
 */
function validateImageUpload({ answerId, imageData, mimeType }) {
  if (!Number.isInteger(answerId) || answerId <= 0) {
    return { valid: false, error: 'Geçersiz cevap ID' };
  }
  if (typeof imageData !== 'string' || imageData.length === 0) {
    return { valid: false, error: 'Görsel verisi gerekli' };
  }
  if (imageData.length > MAX_IMAGE_SIZE) {
    return { valid: false, error: 'Görsel boyutu çok büyük (max 3MB)' };
  }
  if (typeof mimeType !== 'string' || !ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { valid: false, error: 'Geçersiz görsel formatı (jpeg, png, webp, gif)' };
  }
  return { valid: true };
}

/**
 * Oda kodu validasyonu
 */
function validateRoomCode(code) {
  if (typeof code !== 'string') return null;
  const clean = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(clean)) return null;
  return clean;
}

/**
 * Pozitif integer validasyonu
 */
function validatePositiveInt(val) {
  if (!Number.isInteger(val) || val <= 0) return null;
  return val;
}

/**
 * Vote type validasyonu
 */
function validateVoteType(type) {
  const allowed = ['positive', 'negative', 'remove'];
  if (typeof type !== 'string' || !allowed.includes(type)) return null;
  return type;
}

/**
 * Boolean validasyonu
 */
function validateBoolean(val) {
  return typeof val === 'boolean' ? val : null;
}

/**
 * Oda ayarları validasyonu
 */
function validateRoomSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;

  const clean = {};
  const allowedKeys = [
    'name', 'privacy', 'password', 'maxPlayers', 'maxRounds',
    'timePerRound', 'votingTimer', 'answerRevealMode',
  ];

  for (const key of Object.keys(settings)) {
    if (!allowedKeys.includes(key)) continue;
    if (typeof settings[key] === 'string') {
      clean[key] = sanitizeString(settings[key]).slice(0, 100);
    } else if (typeof settings[key] === 'number') {
      clean[key] = settings[key];
    }
  }
  return clean;
}

module.exports = {
  sanitizePayload,
  validateChatMessage,
  validateAnswers,
  validateImageUpload,
  validateRoomCode,
  validatePositiveInt,
  validateVoteType,
  validateBoolean,
  validateRoomSettings,
  MAX_STRING_LENGTH,
  MAX_ANSWER_LENGTH,
};
