const Joi = require('joi');
const mongoose = require('mongoose');
const logger = require('../config/logger'); // Centralized logger
const Chat = require('../models/chat.model');

// Custom error classes (consistent with cart system)
class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.status = 404;
  }
}

// Validation schemas
const sendMessageSchema = Joi.object({
  receiverId: Joi.string()
    .required()
    .custom((value, helpers) => {
      if (!mongoose.isValidObjectId(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'MongoDB ObjectId')
    .messages({
      'any.invalid': 'Invalid receiver ID',
      'any.required': 'Receiver ID is required',
    }),
  message: Joi.string()
    .trim()
    .min(1)
    .max(1000)
    .required()
    .messages({
      'string.min': 'Message cannot be empty',
      'string.max': 'Message cannot exceed 1000 characters',
      'any.required': 'Message is required',
    }),
});

const receiverIdSchema = Joi.object({
  receiverId: Joi.string()
    .required()
    .custom((value, helpers) => {
      if (!mongoose.isValidObjectId(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'MongoDB ObjectId')
    .messages({
      'any.invalid': 'Invalid receiver ID',
      'any.required': 'Receiver ID is required',
    }),
});

// Rule-based chatbot responses
const chatbotResponses = {
  'where is my order': 'Please provide your order ID, and I can check the status for you!',
  'track order': 'You can track your order in the "My Orders" section or provide your order ID here.',
  'return policy': 'Our return policy allows returns within 30 days. Visit our website for details.',
  'contact support': 'You’re already chatting with support! How can I assist you further?',
  'product availability': 'Please specify the product name, and I’ll check its availability.',
};

// AI chatbot function (placeholder for Grok or similar API)
const getAiResponse = async (message) => {
  // Rule-based response for simplicity
  const lowerMessage = message.toLowerCase().trim();
  for (const [trigger, response] of Object.entries(chatbotResponses)) {
    if (lowerMessage.includes(trigger)) {
      return response;
    }
  }
  
  // Placeholder for AI API (e.g., Grok)
  // Example: const aiResponse = await callGrokApi(message);
  return 'I’m not sure how to help with that. Could you clarify or contact support?';
};

// Send a message
const sendMessage = async (req, res) => {
  try {
    const { error } = sendMessageSchema.validate(req.body);
    if (error) {
      logger.error(`Validation error sending message: ${error.details[0].message}`, {
        userId: req.user?.id,
      });
      throw new BadRequestError(error.details[0].message);
    }

    const { receiverId, message } = req.body;

    // Verify receiver exists
    const User = mongoose.model('User');
    const receiver = await User.findById(receiverId).lean();
    if (!receiver) {
      logger.warn(`Receiver not found: ${receiverId}`, { userId: req.user.id });
      throw new NotFoundError('Receiver not found');
    }

    // Save user message
    const chat = new Chat({
      senderId: req.user.id,
      receiverId,
      message,
    });
    await chat.save();

    logger.info(`Message sent from user ${req.user.id} to ${receiverId}`, {
      messageId: chat._id,
    });

    // Check if receiver is a bot (e.g., support bot)
    if (receiver.isBot) { // Assume User model has isBot field
      const aiResponse = await getAiResponse(message);
      const aiChat = new Chat({
        senderId: receiverId,
        receiverId: req.user.id,
        message: aiResponse,
        isAiGenerated: true,
      });
      await aiChat.save();
      logger.info(`AI response sent to user ${req.user.id}`, { messageId: aiChat._id });
    }

    res.status(200).json({ message: 'Message sent successfully', chatId: chat._id });
  } catch (error) {
    logger.error(`Error sending message: ${error.message}`, { userId: req.user?.id });
    res.status(error.status || 500).json({
      message: error.message || 'Failed to send message',
    });
  }
};

// Get chat history
const getChatHistory = async (req, res) => {
  try {
    const { receiverId } = req.params;
    const { error } = receiverIdSchema.validate({ receiverId });
    if (error) {
      logger.error(`Validation error fetching chat history: ${error.details[0].message}`, {
        userId: req.user?.id,
      });
      throw new BadRequestError(error.details[0].message);
    }

    // Verify receiver exists
    const User = mongoose.model('User');
    const receiver = await User.findById(receiverId).lean();
    if (!receiver) {
      logger.warn(`Receiver not found: ${receiverId}`, { userId: req.user.id });
      throw new NotFoundError('Receiver not found');
    }

    // Paginate results (limit to 50 messages)
    const chats = await Chat.find({
      $or: [
        { senderId: req.user.id, receiverId },
        { senderId: receiverId, receiverId: req.user.id },
      ],
    })
      .populate('senderId', 'username') // Adjust fields as needed
      .populate('receiverId', 'username')
      .sort({ createdAt: 1 })
      .limit(50)
      .lean();

    logger.info(`Retrieved chat history for user ${req.user.id} with ${receiverId}`, {
      chatCount: chats.length,
    });
    res.status(200).json({ chats });
  } catch (error) {
    logger.error(`Error fetching chat history: ${error.message}`, { userId: req.user?.id });
    res.status(error.status || 500).json({
      message: error.message || 'Failed to fetch chat history',
    });
  }
};

module.exports = { sendMessage, getChatHistory };