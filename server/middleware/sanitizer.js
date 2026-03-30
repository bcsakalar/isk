const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const MAX_DEPTH = 10;

// Tüm string alanları sanitize et — XSS koruması
function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body, 0);
  }
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query, 0);
  }
  if (req.params && typeof req.params === 'object') {
    sanitizeObject(req.params, 0);
  }
  next();
}

function sanitizeObject(obj, depth) {
  if (depth >= MAX_DEPTH) return;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      obj[key] = DOMPurify.sanitize(obj[key], { ALLOWED_TAGS: [] }).trim();
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key], depth + 1);
    }
  }
}

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return DOMPurify.sanitize(str, { ALLOWED_TAGS: [] }).trim();
}

module.exports = { sanitizeInput, sanitizeString };
