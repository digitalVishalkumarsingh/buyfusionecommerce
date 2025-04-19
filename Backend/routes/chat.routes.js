const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifyToken } = require('../middlewares/verifyToken');
const { authorize } = require('../middlewares/authorize');
const { sendMessage, getChatHistory } = require('../controllers/chat.controller');

const router = express.Router();

/**
 * Rate limiter for sending messages
 */
const sendMessageRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 messages per user
  keyGenerator: (req) => req.user.id,
  message: 'Too many message requests, please try again later.',
});

/**
 * Rate limiter for fetching chat history
 */
const getChatHistoryRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per user
  keyGenerator: (req) => req.user.id,
  message: 'Too many chat history requests, please try again later.',
});

// Send a message
router.post(
  '/',
  verifyToken,
  authorize(['send:chat']),
  sendMessageRateLimiter,
  sendMessage
);

// Get chat history with a specific user
router.get(
  '/:receiverId',
  verifyToken,
  authorize(['view:chat']),
  getChatHistoryRateLimiter,
  getChatHistory
);

module.exports = router;