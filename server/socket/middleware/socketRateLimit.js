// Socket mesaj rate limiting — kötüye kullanımı engelle
const rateLimits = new Map(); // userId/socketId -> { count, resetTime }
const MAX_MESSAGES_PER_SECOND = 5;

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

// Periyodik temizleme
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    if (now > entry.resetTime + 5000) {
      rateLimits.delete(key);
    }
  }
}, 10000);
cleanupInterval.unref();

function stopCleanup() {
  clearInterval(cleanupInterval);
  rateLimits.clear();
}

module.exports = socketRateLimit;
module.exports.stopCleanup = stopCleanup;
