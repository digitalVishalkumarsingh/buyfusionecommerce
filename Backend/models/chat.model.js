const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender ID is required'],
    index: true,
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Receiver ID is required'],
    index: true,
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    minlength: [1, 'Message cannot be empty'],
    maxlength: [1000, 'Message cannot exceed 1000 characters'],
  },
  isAiGenerated: {
    type: Boolean,
    default: false, // Flag for AI-generated messages
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
});

// Compound index for chat history queries
chatSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });

module.exports = mongoose.model('Chat', chatSchema);