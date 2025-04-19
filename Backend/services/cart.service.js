const mongoose = require('mongoose');
const winston = require('winston');
const Cart = require('../models/cart.model');
const Product = require('../models/product.model');

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

class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.status = 403;
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
    new winston.transports.File({ filename: 'logs/cartService.log' }),
  ],
});

class CartService {
  async addItemToCart(userId, productId, quantity, authUserId) {
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(productId)) {
      logger.error(`Invalid ID: user ${userId}, product ${productId}`);
      throw new BadRequestError('Invalid user or product ID');
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      logger.error(`Invalid quantity: ${quantity}`, { userId });
      throw new BadRequestError('Quantity must be a positive integer');
    }
    if (userId !== authUserId) {
      logger.warn(`Unauthorized cart access by user ${authUserId} for user ${userId}`);
      throw new ForbiddenError('Unauthorized to modify this cart');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const product = await Product.findOne({
        _id: productId,
        isActive: true,
        isDeleted: false,
      }).session(session);
      if (!product) {
        logger.warn(`Product not found: ${productId}`, { userId });
        throw new NotFoundError('Product not found or unavailable');
      }
      if (product.stock < quantity) {
        logger.warn(`Insufficient stock for product ${productId}`, { userId });
        throw new BadRequestError(`Insufficient stock for product ${product.name}`);
      }

      let cart = await Cart.findOne({ userId, isDeleted: false }).session(session);
      if (!cart) {
        cart = new Cart({
          userId,
          items: [],
          totalAmount: 0,
          isDeleted: false,
        });
      }

      await cart.addItem(productId, product.name, product.price, quantity, session);
      await session.commitTransaction();
      logger.info(`Added item ${productId} to cart for user ${userId}`);
      return await Cart.findById(cart._id).populate('items.productId', 'name price').lean();
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error adding item to cart: ${error.message}`, { userId, productId });
      throw error.status ? error : new BadRequestError('Failed to add item to cart');
    } finally {
      session.endSession();
    }
  }

  async removeItemFromCart(userId, productId, authUserId) {
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(productId)) {
      logger.error(`Invalid ID: user ${userId}, product ${productId}`);
      throw new BadRequestError('Invalid user or product ID');
    }
    if (userId !== authUserId) {
      logger.warn(`Unauthorized cart access by user ${authUserId} for user ${userId}`);
      throw new ForbiddenError('Unauthorized to modify this cart');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const cart = await Cart.findOne({ userId, isDeleted: false }).session(session);
      if (!cart) {
        logger.warn(`Cart not found for user ${userId}`);
        throw new NotFoundError('Cart not found');
      }

      const itemIndex = cart.items.findIndex(
        (item) => item.productId.toString() === productId
      );
      if (itemIndex === -1) {
        logger.warn(`Item ${productId} not found in cart`, { userId });
        throw new NotFoundError('Item not found in cart');
      }

      cart.items.splice(itemIndex, 1);
      cart.totalAmount = cart.items.reduce((total, item) => total + item.totalPrice, 0);

      await cart.save({ session });
      await session.commitTransaction();
      logger.info(`Removed item ${productId} from cart for user ${userId}`);
      return await Cart.findById(cart._id).populate('items.productId', 'name price').lean();
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error removing item from cart: ${error.message}`, { userId, productId });
      throw error.status ? error : new BadRequestError('Failed to remove item from cart');
    } finally {
      session.endSession();
    }
  }

  async updateCartItemQuantity(userId, productId, quantity, authUserId) {
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(productId)) {
      logger.error(`Invalid ID: user ${userId}, product ${productId}`);
      throw new BadRequestError('Invalid user or product ID');
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      logger.error(`Invalid quantity: ${quantity}`, { userId });
      throw new BadRequestError('Quantity must be a positive integer');
    }
    if (userId !== authUserId) {
      logger.warn(`Unauthorized cart access by user ${authUserId} for user ${userId}`);
      throw new ForbiddenError('Unauthorized to modify this cart');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const product = await Product.findOne({
        _id: productId,
        isActive: true,
        isDeleted: false,
      }).session(session);
      if (!product) {
        logger.warn(`Product not found: ${productId}`, { userId });
        throw new NotFoundError('Product not found or unavailable');
      }
      if (product.stock < quantity) {
        logger.warn(`Insufficient stock for product ${productId}`, { userId });
        throw new BadRequestError(`Insufficient stock for product ${product.name}`);
      }

      const cart = await Cart.findOne({ userId, isDeleted: false }).session(session);
      if (!cart) {
        logger.warn(`Cart not found for user ${userId}`);
        throw new NotFoundError('Cart not found');
      }

      const itemIndex = cart.items.findIndex(
        (item) => item.productId.toString() === productId
      );
      if (itemIndex === -1) {
        logger.warn(`Item ${productId} not found in cart`, { userId });
        throw new NotFoundError('Item not found in cart');
      }

      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].price = product.price;
      cart.items[itemIndex].totalPrice = product.price * quantity;
      cart.totalAmount = cart.items.reduce((total, item) => total + item.totalPrice, 0);

      await cart.save({ session });
      await session.commitTransaction();
      logger.info(`Updated quantity of item ${productId} in cart for user ${userId}`);
      return await Cart.findById(cart._id).populate('items.productId', 'name price').lean();
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error updating item quantity: ${error.message}`, { userId, productId });
      throw error.status ? error : new BadRequestError('Failed to update item quantity');
    } finally {
      session.endSession();
    }
  }

  async clearCart(userId, authUserId) {
    if (!mongoose.isValidObjectId(userId)) {
      logger.error(`Invalid user ID: ${userId}`);
      throw new BadRequestError('Invalid user ID');
    }
    if (userId !== authUserId) {
      logger.warn(`Unauthorized cart access by user ${authUserId} for user ${userId}`);
      throw new ForbiddenError('Unauthorized to clear this cart');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const cart = await Cart.findOne({ userId, isDeleted: false }).session(session);
      if (!cart) {
        logger.warn(`Cart not found for user ${userId}`);
        throw new NotFoundError('Cart not found');
      }

      cart.isDeleted = true;
      cart.items = [];
      cart.totalAmount = 0;

      await cart.save({ session });
      await session.commitTransaction();
      logger.info(`Cleared cart for user ${userId}`);
      return { message: 'Cart cleared successfully' };
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error clearing cart: ${error.message}`, { userId });
      throw error.status ? error : new BadRequestError('Failed to clear cart');
    } finally {
      session.endSession();
    }
  }

  async getUserCart(userId, authUserId) {
    if (!mongoose.isValidObjectId(userId)) {
      logger.error(`Invalid user ID: ${userId}`);
      throw new BadRequestError('Invalid user ID');
    }
    if (userId !== authUserId) {
      logger.warn(`Unauthorized cart access by user ${authUserId} for user ${userId}`);
      throw new ForbiddenError('Unauthorized to view this cart');
    }

    try {
      const cart = await Cart.findOne({ userId, isDeleted: false })
        .populate('items.productId', 'name price stock isActive isDeleted')
        .lean();
      if (!cart) {
        logger.info(`No cart found for user ${userId}, returning empty cart`);
        return { userId, items: [], totalAmount: 0 };
      }
      // Filter out unavailable products
      cart.items = cart.items.filter(
        (item) => item.productId?.isActive && !item.productId?.isDeleted && item.productId?.stock >= item.quantity
      );
      cart.totalAmount = cart.items.reduce((total, item) => total + item.totalPrice, 0);
      logger.info(`Retrieved cart for user ${userId}`);
      return cart;
    } catch (error) {
      logger.error(`Error getting user cart: ${error.message}`, { userId });
      throw error.status ? error : new BadRequestError('Failed to retrieve cart');
    }
  }
}

module.exports = new CartService();