const mongoose = require('mongoose');
const winston = require('winston');
const User = require('../models/user.model');
const Product = require('../models/product.model');
const validator = require('validator');
const { cleanupFailedUpload } = require('../middlewares/fileUpload');
const { getUserOrders, getOrderDetails } = require('./order.service');

// Custom error classes
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.status = 404;
  }
}

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/userService.log' }),
  ],
});

class UserService {
  // Helper to get profile object
  #getProfile(user) {
    return user.fullProfile || {
      _id: user._id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      dateOfBirth: user.dateOfBirth,
      addresses: user.addresses,
      profilePicture: user.profilePicture,
      wishlist: user.wishlist,
      cart: user.cart,
    };
  }

  // Get user profile
  async getUserProfile(userId) {
    if (!mongoose.isValidObjectId(userId)) {
      throw new BadRequestError('Invalid user ID');
    }
    const user = await User.findById(userId)
      .select('-password -resetPasswordToken -resetPasswordExpiry')
      .lean();
    if (!user) throw new NotFoundError('User not found');
    logger.info(`Retrieved profile for user ${userId}`);
    return this.#getProfile(user);
  }

  // Update user profile
  async updateUserProfile(userId, data) {
    if (!mongoose.isValidObjectId(userId)) {
      throw new BadRequestError('Invalid user ID');
    }
    const { name, email, phoneNumber, dateOfBirth } = data;
    if (email && !validator.isEmail(email)) {
      throw new BadRequestError('Invalid email format');
    }
    if (name && !validator.isLength(name.trim(), { min: 2 })) {
      throw new BadRequestError('Name must be at least 2 characters long');
    }
    const updateData = {
      name: name?.trim(),
      email: email?.toLowerCase().trim(),
      phoneNumber: phoneNumber?.trim(),
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    };

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken -resetPasswordExpiry');
    if (!user) throw new NotFoundError('User not found');
    logger.info(`Updated profile for user ${userId}`);
    return this.#getProfile(user);
  }

  // Get user orders (delegate to order.service.js)
  async getUserOrders(userId, { page = 1, limit = 10 } = {}) {
    return await getUserOrders(userId, { page, limit });
  }

  // Get specific order (delegate to order.service.js)
  async getOrderById(userId, orderId) {
    return await getOrderDetails(userId, orderId);
  }

  // Add to wishlist
  async addToWishlist(userId, productId) {
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(productId)) {
      throw new BadRequestError('Invalid user or product ID');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const user = await User.findById(userId).session(session);
      if (!user) throw new NotFoundError('User not found');

      const product = await Product.findById(productId).session(session);
      if (!product) throw new NotFoundError('Product not found');

      if (user.wishlist.includes(productId)) {
        throw new BadRequestError('Product already in wishlist');
      }

      user.wishlist.push(productId);
      await user.save({ session });
      await session.commitTransaction();
      logger.info(`Added product ${productId} to wishlist for user ${userId}`);
      return this.#getProfile(user);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Remove from wishlist
  async removeFromWishlist(userId, productId) {
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(productId)) {
      throw new BadRequestError('Invalid user or product ID');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const user = await User.findById(userId).session(session);
      if (!user) throw new NotFoundError('User not found');

      if (!user.wishlist.includes(productId)) {
        throw new BadRequestError('Product not in wishlist');
      }

      user.wishlist = user.wishlist.filter((id) => id.toString() !== productId);
      await user.save({ session });
      await session.commitTransaction();
      logger.info(`Removed product ${productId} from wishlist for user ${userId}`);
      return this.#getProfile(user);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Add to cart
  async addToCart(userId, productId, quantity) {
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(productId)) {
      throw new BadRequestError('Invalid user or product ID');
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestError('Quantity must be a positive integer');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const user = await User.findById(userId).session(session);
      if (!user) throw new NotFoundError('User not found');

      const product = await Product.findById(productId).session(session);
      if (!product) throw new NotFoundError('Product not found');

      const cartItem = user.cart.find((item) => item.productId.toString() === productId);
      if (cartItem) {
        cartItem.quantity = quantity;
      } else {
        user.cart.push({ productId, quantity });
      }

      await user.save({ session });
      await session.commitTransaction();
      logger.info(`Added product ${productId} to cart for user ${userId}`);
      return this.#getProfile(user);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Remove from cart
  async removeFromCart(userId, productId) {
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(productId)) {
      throw new BadRequestError('Invalid user or product ID');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const user = await User.findById(userId).session(session);
      if (!user) throw new NotFoundError('User not found');

      const cartItemIndex = user.cart.findIndex((item) => item.productId.toString() === productId);
      if (cartItemIndex === -1) {
        throw new BadRequestError('Product not in cart');
      }

      user.cart.splice(cartItemIndex, 1);
      await user.save({ session });
      await session.commitTransaction();
      logger.info(`Removed product ${productId} from cart for user ${userId}`);
      return this.#getProfile(user);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Update profile picture
  async updateUserProfilePicture(userId, file) {
    if (!mongoose.isValidObjectId(userId)) {
      throw new BadRequestError('Invalid user ID');
    }
    if (!file) {
      throw new BadRequestError('No file uploaded');
    }

    const fileUrl = file.url; // Cloudinary secure_url
    const publicId = file.public_id; // Cloudinary public_id

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: { profilePicture: { url: fileUrl, publicId } } },
        { new: true, runValidators: true }
      )
        .select('-password -resetPasswordToken -resetPasswordExpiry')
        .session(session);
      if (!user) {
        await cleanupFailedUpload(publicId);
        throw new NotFoundError('User not found');
      }
      await session.commitTransaction();
      logger.info(`Updated profile picture for user ${userId}`, { publicId });
      return this.#getProfile(user);
    } catch (error) {
      await session.abortTransaction();
      await cleanupFailedUpload(publicId);
      throw error;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new UserService();