const adminQueries = require('../db/queries/admin.queries');
const usersQueries = require('../db/queries/users.queries');
const roomsQueries = require('../db/queries/rooms.queries');
const gamesQueries = require('../db/queries/games.queries');
const contactService = require('../services/contact.service');

const adminController = {
  async dashboard(req, res, next) {
    try {
      const stats = await adminQueries.getStats();
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  },

  async listUsers(req, res, next) {
    try {
      const { search } = req.query;
      let users;
      if (search) {
        users = await usersQueries.searchUsers(search);
      } else {
        users = await usersQueries.listAllForAdmin(100);
      }
      res.json({ success: true, data: users });
    } catch (err) {
      next(err);
    }
  },

  async getUserDetail(req, res, next) {
    try {
      const { userId } = req.params;
      const user = await usersQueries.findById(parseInt(userId, 10));
      if (!user) {
        return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
      }
      const { password_hash, ...safeUser } = user;
      res.json({ success: true, data: safeUser });
    } catch (err) {
      next(err);
    }
  },

  async banUser(req, res, next) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      await usersQueries.banUser(parseInt(userId, 10), reason || 'Kural ihlali');
      await adminQueries.logAction({
        adminId: req.user.id,
        action: 'ban_user',
        targetType: 'user',
        targetId: parseInt(userId, 10),
        details: { reason },
        ipAddress: req.ip,
      });
      res.json({ success: true, message: 'Kullanıcı yasaklandı' });
    } catch (err) {
      next(err);
    }
  },

  async unbanUser(req, res, next) {
    try {
      const { userId } = req.params;
      await usersQueries.unbanUser(parseInt(userId, 10));
      await adminQueries.logAction({
        adminId: req.user.id,
        action: 'unban_user',
        targetType: 'user',
        targetId: parseInt(userId, 10),
        ipAddress: req.ip,
      });
      res.json({ success: true, message: 'Yasak kaldırıldı' });
    } catch (err) {
      next(err);
    }
  },

  async setRole(req, res, next) {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      if (!['player', 'moderator', 'admin'].includes(role)) {
        return res.status(400).json({ success: false, error: 'Geçersiz rol' });
      }
      await usersQueries.setRole(parseInt(userId, 10), role);
      await adminQueries.logAction({
        adminId: req.user.id,
        action: 'set_role',
        targetType: 'user',
        targetId: parseInt(userId, 10),
        details: { role },
        ipAddress: req.ip,
      });
      res.json({ success: true, message: 'Rol güncellendi' });
    } catch (err) {
      next(err);
    }
  },

  async listRooms(req, res, next) {
    try {
      const rooms = await roomsQueries.listActive(100);
      res.json({ success: true, data: rooms });
    } catch (err) {
      next(err);
    }
  },

  async getRoomDetail(req, res, next) {
    try {
      const { roomId } = req.params;
      const room = await roomsQueries.findById(parseInt(roomId, 10));
      if (!room) {
        return res.status(404).json({ success: false, error: 'Oda bulunamadı' });
      }
      const players = await roomsQueries.getPlayers(room.id);
      const categories = await roomsQueries.getCategories(room.id);
      res.json({ success: true, data: { ...room, players, categories } });
    } catch (err) {
      next(err);
    }
  },

  async closeRoom(req, res, next) {
    try {
      const { roomId } = req.params;
      await roomsQueries.updateStatus(parseInt(roomId, 10), 'abandoned');
      await adminQueries.logAction({
        adminId: req.user.id,
        action: 'close_room',
        targetType: 'room',
        targetId: parseInt(roomId, 10),
        ipAddress: req.ip,
      });
      res.json({ success: true, message: 'Oda kapatıldı' });
    } catch (err) {
      next(err);
    }
  },

  async createAnnouncement(req, res, next) {
    try {
      const { title, content, target, targetRoomId, expiresAt } = req.body;
      const announcement = await adminQueries.createAnnouncement({
        adminId: req.user.id,
        title, content,
        target: target || 'all',
        targetRoomId,
        expiresAt,
      });

      // Socket.IO broadcast
      const io = req.app.get('io');
      if (io) {
        const payload = { title, content };
        if (target === 'room' && targetRoomId) {
          io.to(`room:${targetRoomId}`).emit('announcement', payload);
        } else if (target === 'lobby') {
          io.to('lobby').emit('announcement', payload);
        } else {
          io.emit('announcement', payload);
        }
      }

      await adminQueries.logAction({
        adminId: req.user.id,
        action: 'send_announcement',
        targetType: 'system',
        details: { title, target },
        ipAddress: req.ip,
      });
      res.status(201).json({ success: true, data: announcement });
    } catch (err) {
      next(err);
    }
  },

  async getAnnouncements(req, res, next) {
    try {
      const announcements = await adminQueries.getActiveAnnouncements();
      res.json({ success: true, data: announcements });
    } catch (err) {
      next(err);
    }
  },

  async getLogs(req, res, next) {
    try {
      const { limit, offset } = req.query;
      const logs = await adminQueries.getLogs(parseInt(limit, 10) || 100, parseInt(offset, 10) || 0);
      res.json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  },

  async getReports(req, res, next) {
    try {
      const { status } = req.query;
      const reports = await adminQueries.getReports(status || null);
      res.json({ success: true, data: reports });
    } catch (err) {
      next(err);
    }
  },

  async reviewReport(req, res, next) {
    try {
      const { reportId } = req.params;
      const { status, adminNote } = req.body;
      await adminQueries.reviewReport(parseInt(reportId, 10), {
        status, adminNote, reviewedBy: req.user.id,
      });
      res.json({ success: true, message: 'Rapor güncellendi' });
    } catch (err) {
      next(err);
    }
  },

  async getChatMessages(req, res, next) {
    try {
      const { roomId } = req.query;
      const messages = await gamesQueries.getMessages(roomId ? parseInt(roomId, 10) : null, 100);
      res.json({ success: true, data: messages });
    } catch (err) {
      next(err);
    }
  },

  async deleteMessage(req, res, next) {
    try {
      const { messageId } = req.params;
      await gamesQueries.deleteMessage(parseInt(messageId, 10));
      await adminQueries.logAction({
        adminId: req.user.id,
        action: 'delete_message',
        targetType: 'chat',
        targetId: parseInt(messageId, 10),
        ipAddress: req.ip,
      });
      res.json({ success: true, message: 'Mesaj silindi' });
    } catch (err) {
      next(err);
    }
  },

  async listContactMessages(req, res, next) {
    try {
      const { limit, offset } = req.query;
      const messages = await contactService.getMessages(
        parseInt(limit, 10) || 50,
        parseInt(offset, 10) || 0
      );
      res.json({ success: true, data: messages });
    } catch (err) {
      next(err);
    }
  },

  async getContactUnreadCount(req, res, next) {
    try {
      const count = await contactService.getUnreadCount();
      res.json({ success: true, data: { count } });
    } catch (err) {
      next(err);
    }
  },

  async markContactAsRead(req, res, next) {
    try {
      const { id } = req.params;
      const result = await contactService.markAsRead(parseInt(id, 10), req.user.id);
      await adminQueries.logAction({
        adminId: req.user.id,
        action: 'read_contact_message',
        targetType: 'contact',
        targetId: parseInt(id, 10),
        ipAddress: req.ip,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async deleteAnnouncement(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminQueries.deleteAnnouncement(parseInt(id, 10));
      if (!result) {
        return res.status(404).json({ success: false, error: 'Duyuru bulunamadı' });
      }
      await adminQueries.logAction({
        adminId: req.user.id,
        action: 'delete_announcement',
        targetType: 'announcement',
        targetId: parseInt(id, 10),
        ipAddress: req.ip,
      });
      res.json({ success: true, message: 'Duyuru silindi' });
    } catch (err) {
      next(err);
    }
  },

  async deleteContactMessage(req, res, next) {
    try {
      const { id } = req.params;
      const result = await contactService.deleteMessage(parseInt(id, 10));
      if (!result) {
        return res.status(404).json({ success: false, error: 'Mesaj bulunamadı' });
      }
      await adminQueries.logAction({
        adminId: req.user.id,
        action: 'delete_contact_message',
        targetType: 'contact',
        targetId: parseInt(id, 10),
        ipAddress: req.ip,
      });
      res.json({ success: true, message: 'Mesaj silindi' });
    } catch (err) {
      next(err);
    }
  },

  async clearLogs(req, res, next) {
    try {
      const count = await adminQueries.clearLogs();
      res.json({ success: true, message: `${count} log kaydı temizlendi` });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = adminController;
