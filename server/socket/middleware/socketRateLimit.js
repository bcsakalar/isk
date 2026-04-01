// Socket mesaj rate limiting — kötüye kullanımı engelle
const rateLimits = new Map(); // userId/socketId -> { count, resetTime }
const MAX_MESSAGES_PER_SECOND = 5;

// Event bazlı rate limit kuralları (event prefix → { max, windowMs })
const EVENT_LIMITS = {
  'game:upload_image': { max: 1, windowMs: 3000 },  // 1 upload / 3 saniye
  'chat:': { max: 3, windowMs: 1000 },               // 3 mesaj / 1 saniye
};
const eventRateLimits = new Map(); // `${key}:${event}` -> { count, resetTime }

function socketRateLimit(socket, next) {
  const now = Date.now();
  // Kullanıcı ID'si ile keyleyerek yeniden bağlanma ile bypass'ı engelle
  const key = socket.user?.id || socket.id;
  let entry = rateLimits.get(key);

  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + 1000 };
    rateLimits.set(key, entry);
  }

  entry.count++;

  if (entry.count > MAX_MESSAGES_PER_SECOND) {
    return next(new Error('Rate limit aşıldı'));
  }

  next();
}

// Event bazlı rate limit kontrolü — handler içinden çağrılır
function checkEventLimit(userId, eventName) {
  const now = Date.now();

  // Eşleşen event kural bul (prefix match)
  let rule = EVENT_LIMITS[eventName];
  if (!rule) {
    for (const [prefix, r] of Object.entries(EVENT_LIMITS)) {
      if (eventName.startsWith(prefix)) {
        rule = r;
        break;
      }
    }
  }
  if (!rule) return true; // Kural yoksa izin ver

  const mapKey = `${userId}:${eventName}`;
  let entry = eventRateLimits.get(mapKey);

  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + rule.windowMs };
    eventRateLimits.set(mapKey, entry);
  }

  entry.count++;
  return entry.count <= rule.max;
}

// Periyodik temizleme
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    if (now > entry.resetTime + 5000) {
      rateLimits.delete(key);
    }
  }
  for (const [key, entry] of eventRateLimits) {
    if (now > entry.resetTime + 5000) {
      eventRateLimits.delete(key);
    }
  }
}, 10000);
cleanupInterval.unref();

function stopCleanup() {
  clearInterval(cleanupInterval);
  rateLimits.clear();
  eventRateLimits.clear();
}

function clearLimits() {
  rateLimits.clear();
  eventRateLimits.clear();
}

module.exports = socketRateLimit;
module.exports.stopCleanup = stopCleanup;
module.exports.checkEventLimit = checkEventLimit;
module.exports.clearLimits = clearLimits;
