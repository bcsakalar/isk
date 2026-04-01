const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');
const usersQueries = require('../db/queries/users.queries');
const { query } = require('../config/database');
const { BadRequestError, UnauthorizedError, ConflictError } = require('../utils/errors');

const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 dakika

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const authService = {
  async register({ username, password, displayName }) {
    // Validasyon
    if (!username || !password) {
      throw new BadRequestError('Kullanıcı adı ve şifre zorunludur');
    }
    if (username.length < 3 || username.length > 20) {
      throw new BadRequestError('Kullanıcı adı 3-20 karakter arasında olmalıdır');
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      throw new BadRequestError('Kullanıcı adı sadece harf, rakam ve _ içerebilir');
    }
    if (password.length < 8) {
      throw new BadRequestError('Şifre en az 8 karakter olmalıdır');
    }
    if (!/[A-Z]/.test(password)) {
      throw new BadRequestError('Şifre en az bir büyük harf içermelidir');
    }
    if (!/[0-9]/.test(password)) {
      throw new BadRequestError('Şifre en az bir rakam içermelidir');
    }

    // Benzersizlik kontrolü
    const existingUser = await usersQueries.findByUsername(username);
    if (existingUser) throw new ConflictError('Bu kullanıcı adı zaten kullanılıyor');

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await usersQueries.create({
      username,
      email: null,
      passwordHash,
      displayName: displayName || username,
    });

    const tokens = await this.generateTokens(user);
    return { user, ...tokens };
  },

  async login({ username, password, ip, userAgent }) {
    if (!username || !password) {
      throw new BadRequestError('Kullanıcı adı ve şifre zorunludur');
    }

    // Kullanıcı adı ile giriş
    let user = await usersQueries.findByUsername(username);
    if (!user) {
      throw new UnauthorizedError('Geçersiz kullanıcı adı veya şifre');
    }

    if (user.is_banned) {
      throw new UnauthorizedError('Geçersiz kullanıcı adı veya şifre');
    }

    // Misafir kullanıcılar normal login yapamaz
    if (user.is_guest) {
      throw new UnauthorizedError('Geçersiz kullanıcı adı veya şifre');
    }

    // Hesap kilitleme kontrolü
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainingMs = new Date(user.locked_until) - new Date();
      const remainingMin = Math.ceil(remainingMs / 60000);
      throw new UnauthorizedError(`Hesabınız geçici olarak kilitlendi. ${remainingMin} dakika sonra tekrar deneyin`);
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      // Başarısız giriş sayacını artır
      const attempts = (user.failed_login_attempts || 0) + 1;
      await usersQueries.incrementFailedLogin(user.id);

      if (attempts >= MAX_FAILED_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await usersQueries.lockAccount(user.id, lockUntil);
        throw new UnauthorizedError('Çok fazla başarısız giriş denemesi. Hesabınız 15 dakika süreyle kilitlendi');
      }

      throw new UnauthorizedError('Geçersiz kullanıcı adı veya şifre');
    }

    // Başarılı giriş — kilidi ve sayacı sıfırla
    if (user.failed_login_attempts > 0 || user.locked_until) {
      await usersQueries.resetFailedLogin(user.id);
    }

    await usersQueries.updateLastLogin(user.id);
    const tokens = await this.generateTokens(user, ip, userAgent);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        role: user.role,
        xp: user.xp,
        level: user.level,
      },
      ...tokens,
    };
  },

  async guestLogin({ nickname }) {
    if (!nickname || nickname.trim().length < 3 || nickname.trim().length > 15) {
      throw new BadRequestError('Takma ad 3-15 karakter arasında olmalıdır');
    }

    const cleanNickname = nickname.trim();
    if (!/^[a-zA-Z0-9_\u00C0-\u024F\u0100-\u017F\u011E\u011F\u0130\u0131\u015E\u015F\u00D6\u00F6\u00DC\u00FC\u00C7\u00E7]+$/.test(cleanNickname)) {
      throw new BadRequestError('Takma ad sadece harf, rakam ve _ içerebilir');
    }

    // Benzersiz misafir username oluştur
    const guestId = uuidv4().slice(0, 6).toUpperCase();
    const guestUsername = `misafir_${guestId}`;

    // 24 saat sonra expire olacak
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await usersQueries.createGuest({
      username: guestUsername,
      displayName: cleanNickname,
      expiresAt,
    });

    // Misafirler için sadece access token (refresh token yok)
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, displayName: user.display_name || cleanNickname, role: 'guest', level: 1 },
      env.jwt.secret,
      { expiresIn: '24h' }
    );

    return { user, accessToken };
  },

  async refreshToken(refreshToken, { ip, userAgent } = {}) {
    if (!refreshToken) throw new UnauthorizedError('Refresh token gerekli');

    // Token'ı hashleyip veritabanında ara
    const tokenHash = hashToken(refreshToken);
    const result = await query(
      'SELECT * FROM user_sessions WHERE refresh_token = $1 AND expires_at > now()',
      [tokenHash]
    );
    const session = result.rows[0];
    if (!session) {
      // Çalıntı token tespiti: Eğer bu token daha önce kullanıldıysa (DB'de yoksa)
      // tüm kullanıcı oturumlarını kapat (token reuse = theft)
      // Not: Burada kullanıcıyı bilemeyiz, sadece geçersiz token olarak logla
      throw new UnauthorizedError('Geçersiz veya süresi dolmuş refresh token');
    }

    // IP/User-Agent uyumsuzluk kontrolü (şüpheli token kullanımı tespiti)
    if (ip && session.ip_address && ip !== session.ip_address) {
      const logger = require('../utils/logger');
      logger.warn('Refresh token IP mismatch — possible token theft', {
        userId: session.user_id,
        sessionIp: session.ip_address,
        requestIp: ip,
      });
    }

    const user = await usersQueries.findById(session.user_id);
    if (!user || user.is_banned) {
      await query('DELETE FROM user_sessions WHERE user_id = $1', [session.user_id]);
      throw new UnauthorizedError('Geçersiz oturum');
    }

    // Token Rotation: Eski refresh token'ı sil, yeni çift oluştur
    await query('DELETE FROM user_sessions WHERE id = $1', [session.id]);

    const tokens = await this.generateTokens(user, session.ip_address, session.user_agent);
    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        level: user.level,
      },
      ...tokens,
    };
  },

  async logout(refreshToken) {
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await query('DELETE FROM user_sessions WHERE refresh_token = $1', [tokenHash]);
    }
  },

  async generateTokens(user, ip, userAgent) {
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, displayName: user.display_name || user.username, role: user.role, level: user.level },
      env.jwt.secret,
      { expiresIn: env.jwt.expiresIn }
    );

    const refreshToken = uuidv4() + '-' + uuidv4();
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + parseDuration(env.jwt.refreshExpiresIn));

    await query(
      `INSERT INTO user_sessions (user_id, refresh_token, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, refreshTokenHash, ip || null, userAgent || null, expiresAt]
    );

    return { accessToken, refreshToken };
  },
};

function parseDuration(str) {
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 gün
  const val = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return val * 1000;
    case 'm': return val * 60 * 1000;
    case 'h': return val * 60 * 60 * 1000;
    case 'd': return val * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}

module.exports = authService;
