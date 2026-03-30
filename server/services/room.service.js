const roomsQueries = require('../db/queries/rooms.queries');
const gamesQueries = require('../db/queries/games.queries');
const usersQueries = require('../db/queries/users.queries');
const { generateRoomCode } = require('../utils/crypto');
const { BadRequestError, NotFoundError, ForbiddenError, ConflictError } = require('../utils/errors');
const bcrypt = require('bcrypt');

const roomService = {
  async createRoom({ userId, name, maxPlayers, totalRounds, timePerRound, isPrivate, password, categoryIds, answerRevealMode, votingTimer, enabledLetters }) {
    if (!name || name.length < 2 || name.length > 40) {
      throw new BadRequestError('Oda adı 2-40 karakter arasında olmalıdır');
    }

    let code;
    let attempts = 0;
    do {
      code = generateRoomCode();
      const existing = await roomsQueries.findByCode(code);
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) throw new BadRequestError('Oda kodu oluşturulamadı, tekrar deneyin');

    let passwordHash = null;
    if (isPrivate && password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const room = await roomsQueries.create({
      code,
      name,
      ownerId: userId,
      maxPlayers: maxPlayers || 8,
      totalRounds: totalRounds || 10,
      timePerRound: timePerRound || 90,
      isPrivate: isPrivate || false,
      passwordHash,
      answerRevealMode: answerRevealMode || 'direct',
      votingTimer: votingTimer ?? 60,
      enabledLetters: enabledLetters || undefined,
    });

    // Kategorileri ayarla
    if (categoryIds && categoryIds.length) {
      await roomsQueries.setCategories(room.id, categoryIds);
    } else {
      const defaults = await gamesQueries.getDefaultCategories();
      if (defaults.length) {
        await roomsQueries.setCategories(room.id, defaults.map(c => c.id));
      }
    }

    // Oda sahibini ekle
    await roomsQueries.addPlayer(room.id, userId);

    return room;
  },

  async joinRoom({ userId, code, password }) {
    const room = await roomsQueries.findByCode(code);
    if (!room) throw new NotFoundError('Oda bulunamadı');

    if (room.status === 'abandoned') {
      throw new BadRequestError('Bu oda artık aktif değil');
    }

    // Zaten odada mı? (şifre ve kapasite kontrolünden önce)
    const existing = await roomsQueries.getPlayerByRoomAndUser(room.id, userId);
    if (existing) return { room, player: existing, alreadyJoined: true };

    // Finished odalara yeni oyuncu katılamaz
    if (room.status === 'finished') {
      throw new BadRequestError('Bu oda artık aktif değil');
    }

    // Şifre kontrolü
    if (room.is_private && room.password_hash) {
      if (!password) throw new BadRequestError('Bu oda şifre ile korunuyor');
      const valid = await bcrypt.compare(password, room.password_hash);
      if (!valid) throw new ForbiddenError('Oda şifresi yanlış');
    }

    // Kapasite kontrolü
    const count = await roomsQueries.getPlayerCount(room.id);
    if (count >= room.max_players) {
      throw new ConflictError('Oda dolu');
    }

    const player = await roomsQueries.addPlayer(room.id, userId);
    await roomsQueries.touchActivity(room.id);

    return { room, player, alreadyJoined: false };
  },

  async leaveRoom({ userId, roomId }) {
    const room = await roomsQueries.findById(roomId);
    if (!room) throw new NotFoundError('Oda bulunamadı');

    await roomsQueries.removePlayer(roomId, userId);
    await roomsQueries.touchActivity(roomId);

    // Odada kimse kalmadıysa oda'yı kapat
    const count = await roomsQueries.getPlayerCount(roomId);
    let newOwnerId = null;
    if (count === 0) {
      await roomsQueries.updateStatus(roomId, 'abandoned');
    } else if (room.owner_id === userId) {
      // Oda sahibi çıkarsa ownership transfer et
      const players = await roomsQueries.getPlayers(roomId);
      if (players.length > 0) {
        newOwnerId = players[0].user_id;
        const { query: dbQuery } = require('../config/database');
        await dbQuery('UPDATE rooms SET owner_id = $1 WHERE id = $2', [newOwnerId, roomId]);
      }
    }

    return { playerCount: count, newOwnerId, abandoned: count === 0 };
  },

  async transferOwnership({ roomId, ownerId, targetUserId }) {
    const room = await roomsQueries.findById(roomId);
    if (!room) throw new NotFoundError('Oda bulunamadı');
    if (room.owner_id !== ownerId) throw new ForbiddenError('Sadece oda sahibi sahipliği devredebilir');
    if (room.status !== 'waiting') throw new BadRequestError('Oyun başlamışken sahiplik devredilemez');

    // Hedef oyuncunun odada olduğunu doğrula
    const target = await roomsQueries.getPlayerByRoomAndUser(roomId, targetUserId);
    if (!target) throw new BadRequestError('Hedef oyuncu bu odada değil');

    if (ownerId === targetUserId) throw new BadRequestError('Zaten oda sahibisiniz');

    const { query: dbQuery } = require('../config/database');
    await dbQuery('UPDATE rooms SET owner_id = $1 WHERE id = $2', [targetUserId, roomId]);

    return { newOwnerId: targetUserId };
  },

  async getRoom(roomId) {
    const room = await roomsQueries.findById(roomId);
    if (!room) throw new NotFoundError('Oda bulunamadı');

    const players = await roomsQueries.getPlayers(roomId);
    const categories = await roomsQueries.getCategories(roomId);

    const { password_hash, ...safeRoom } = room;
    return { ...safeRoom, has_password: !!password_hash, players, categories };
  },

  async getRoomByCode(code) {
    const room = await roomsQueries.findByCode(code);
    if (!room) throw new NotFoundError('Oda bulunamadı');

    const players = await roomsQueries.getPlayers(room.id);
    const categories = await roomsQueries.getCategories(room.id);

    const { password_hash, ...safeRoom } = room;
    return { ...safeRoom, has_password: !!password_hash, players, categories };
  },

  async listActiveRooms() {
    const rooms = await roomsQueries.listActive(50);
    return rooms.filter(r => !r.has_password && !r.is_private);
  },

  async listPublicRooms() {
    const rooms = await roomsQueries.listActive(50);
    return rooms
      .filter(r => !r.has_password && !r.is_private)
      .map(({ id, owner_id, code, ...safe }) => safe);
  },

  async setReady(roomId, userId, ready) {
    await roomsQueries.setPlayerReady(roomId, userId, ready);
    const players = await roomsQueries.getPlayers(roomId);
    const allReady = players.length >= 2 && players.every(p => p.is_ready);
    return { players, allReady };
  },

  async updateSettings(roomId, userId, settings) {
    const room = await roomsQueries.findById(roomId);
    if (!room) throw new NotFoundError('Oda bulunamadı');
    if (room.owner_id !== userId) throw new ForbiddenError('Sadece oda sahibi ayarları değiştirebilir');
    if (room.status !== 'waiting') throw new BadRequestError('Oyun başlamışken ayarlar değiştirilemez');

    const updates = {};

    if (settings.name !== undefined) {
      if (!settings.name || settings.name.length < 2 || settings.name.length > 40) {
        throw new BadRequestError('Oda adı 2-40 karakter arasında olmalıdır');
      }
      updates.name = settings.name;
    }
    if (settings.maxPlayers !== undefined) {
      const mp = parseInt(settings.maxPlayers, 10);
      if (!Number.isFinite(mp) || mp < 2 || mp > 15) throw new BadRequestError('Oyuncu sayısı 2-15 arasında olmalıdır');
      updates.max_players = mp;
    }
    if (settings.totalRounds !== undefined) {
      const tr = parseInt(settings.totalRounds, 10);
      if (!Number.isFinite(tr) || tr < 1 || tr > 15) throw new BadRequestError('Tur sayısı 1-15 arasında olmalıdır');
      updates.total_rounds = tr;
    }
    if (settings.timePerRound !== undefined) {
      const tpr = parseInt(settings.timePerRound, 10);
      if (!Number.isFinite(tpr) || tpr < 30 || tpr > 300) throw new BadRequestError('Süre 30-300 saniye arasında olmalıdır');
      updates.time_per_round = tpr;
    }
    if (settings.votingTimer !== undefined) {
      const vt = parseInt(settings.votingTimer, 10);
      if (!Number.isFinite(vt) || (vt !== 0 && (vt < 10 || vt > 300))) throw new BadRequestError('Oylama süresi 0 (süresiz) veya 10-300 saniye arasında olmalıdır');
      updates.voting_timer = vt;
    }
    if (settings.answerRevealMode !== undefined) {
      if (!['direct', 'button'].includes(settings.answerRevealMode)) {
        throw new BadRequestError('Geçersiz cevap gösterme modu');
      }
      updates.answer_reveal_mode = settings.answerRevealMode;
    }
    if (settings.privacy !== undefined) {
      settings.isPrivate = settings.privacy === 'private';
    }
    if (settings.isPrivate !== undefined) {
      updates.is_private = !!settings.isPrivate;
      if (settings.isPrivate && settings.password) {
        updates.password_hash = await bcrypt.hash(settings.password, 10);
      } else if (!settings.isPrivate) {
        updates.password_hash = null;
      }
    }

    const updated = await roomsQueries.updateSettings(roomId, updates);
    if (updated) {
      const { password_hash, ...safeUpdated } = updated;
      return { ...safeUpdated, has_password: !!password_hash };
    }
    return updated;
  },

  async updateCategories(roomId, userId, categoryIds) {
    const room = await roomsQueries.findById(roomId);
    if (!room) throw new NotFoundError('Oda bulunamadı');
    if (room.owner_id !== userId) throw new ForbiddenError('Sadece oda sahibi kategorileri değiştirebilir');
    if (room.status !== 'waiting') throw new BadRequestError('Oyun başlamışken kategoriler değiştirilemez');
    if (!categoryIds || categoryIds.length < 1) throw new BadRequestError('En az 1 kategori seçilmelidir');

    await roomsQueries.setCategories(roomId, categoryIds);
    return roomsQueries.getCategories(roomId);
  },

  async addCategory(roomId, userId, name) {
    const room = await roomsQueries.findById(roomId);
    if (!room) throw new NotFoundError('Oda bulunamadı');
    if (room.owner_id !== userId) throw new ForbiddenError('Sadece oda sahibi kategori ekleyebilir');
    if (room.status !== 'waiting') throw new BadRequestError('Oyun başlamışken kategori eklenemez');

    if (!name || name.length < 2 || name.length > 50) {
      throw new BadRequestError('Kategori adı 2-50 karakter arasında olmalıdır');
    }

    const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_çğıöşü]/g, '');
    const category = await roomsQueries.addCustomCategory(name, slug);

    const count = await roomsQueries.getCategoryCount(roomId);
    await roomsQueries.addCategoryToRoom(roomId, category.id, count);

    return roomsQueries.getCategories(roomId);
  },

  async removeCategory(roomId, userId, categoryId) {
    const room = await roomsQueries.findById(roomId);
    if (!room) throw new NotFoundError('Oda bulunamadı');
    if (room.owner_id !== userId) throw new ForbiddenError('Sadece oda sahibi kategori kaldırabilir');
    if (room.status !== 'waiting') throw new BadRequestError('Oyun başlamışken kategori kaldırılamaz');

    const count = await roomsQueries.getCategoryCount(roomId);
    if (count <= 1) throw new BadRequestError('En az 1 kategori bulunmalıdır');

    await roomsQueries.removeCategoryFromRoom(roomId, parseInt(categoryId, 10));
    return roomsQueries.getCategories(roomId);
  },

  async updateLetters(roomId, userId, letters) {
    const room = await roomsQueries.findById(roomId);
    if (!room) throw new NotFoundError('Oda bulunamadı');
    if (room.owner_id !== userId) throw new ForbiddenError('Sadece oda sahibi harfleri değiştirebilir');
    if (room.status !== 'waiting') throw new BadRequestError('Oyun başlamışken harfler değiştirilemez');

    if (!Array.isArray(letters) || letters.length < 5) {
      throw new BadRequestError('En az 5 harf seçilmelidir');
    }

    const validLetters = 'A,B,C,Ç,D,E,F,G,Ğ,H,I,İ,J,K,L,M,N,O,Ö,P,R,S,Ş,T,U,Ü,V,Y,Z'.split(',');
    const filtered = letters.filter(l => validLetters.includes(l));
    if (filtered.length < 5) throw new BadRequestError('En az 5 geçerli harf seçilmelidir');

    const enabledLetters = filtered.join(',');
    await roomsQueries.updateSettings(roomId, { enabled_letters: enabledLetters });
    return filtered;
  },
};

module.exports = roomService;
