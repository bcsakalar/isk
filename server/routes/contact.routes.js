const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact.controller');
const { contactLimiter } = require('../middleware/rateLimiter');

// Public endpoint — auth gerektirmez
router.post('/', contactLimiter, contactController.submit);

module.exports = router;
