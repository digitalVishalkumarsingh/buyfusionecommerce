const express = require('express');
const { verifyToken } = require('../middlewares/verifyToken');
const { sendNotification } = require('../controllers/notification.controller');

const router = express.Router();

// Admin Route: Send push notification to a user
router.post('/', verifyToken, sendNotification);

module.exports = router;
