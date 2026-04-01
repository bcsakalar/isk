const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticateToken } = require('../middleware/auth');
const { adminGuard } = require('../middleware/adminGuard');
const { apiLimiter } = require('../middleware/rateLimiter');

router.use(authenticateToken, adminGuard);
router.use(apiLimiter);

router.get('/dashboard', adminController.dashboard);
router.get('/users', adminController.listUsers);
router.get('/users/:userId', adminController.getUserDetail);
router.post('/users/:userId/ban', adminController.banUser);
router.post('/users/:userId/unban', adminController.unbanUser);
router.post('/users/:userId/role', adminController.setRole);
router.get('/rooms', adminController.listRooms);
router.get('/rooms/:roomId', adminController.getRoomDetail);
router.post('/rooms/:roomId/close', adminController.closeRoom);
router.delete('/rooms/:roomId', adminController.closeRoom);
router.post('/announcements', adminController.createAnnouncement);
router.get('/announcements', adminController.getAnnouncements);
router.delete('/announcements/:id', adminController.deleteAnnouncement);
router.get('/logs', adminController.getLogs);
router.delete('/logs', adminController.clearLogs);
router.get('/reports', adminController.getReports);
router.post('/reports/:reportId/review', adminController.reviewReport);
router.get('/chat', adminController.getChatMessages);
router.delete('/chat/:messageId', adminController.deleteMessage);
router.get('/contact', adminController.listContactMessages);
router.get('/contact/unread-count', adminController.getContactUnreadCount);
router.post('/contact/:id/read', adminController.markContactAsRead);
router.delete('/contact/:id', adminController.deleteContactMessage);

module.exports = router;
