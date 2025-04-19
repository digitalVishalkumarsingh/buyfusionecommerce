const Joi = require('joi');
const winston = require('winston');
const CartService = require('../services/cart.service');

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/cartController.log' }),
  ],
});

// Validation schemas
const cartItemSchema = Joi.object({
  productId: Joi.string()
    .required()
    .custom((value, helpers) => {
      if (!require('mongoose').isValidObjectId(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'MongoDB ObjectId')
    .messages({
      'any.invalid': 'Invalid product ID',
    }),
  quantity: Joi.number().integer().min(1).required().messages({
    'number.min': 'Quantity must be at least 1',
  }),
});

module.exports = {
  // Add an item to the cart
  addItemToCartController: async (req, res) => {
    try {
      const { error } = cartItemSchema.validate(req.body);
      if (error) {
        logger.error(`Validation error adding item to cart: ${error.details[0].message}`, {
          userId: req.user?.id,
        });
        return res.status(400).json({ message: error.details[0].message });
      }

      const { productId, quantity } = req.body;
      const cart = await CartService.addItemToCart(req.user.id, productId, quantity, req.user.id);
      logger.info(`Added item ${productId} to cart for user ${req.user.id}`);
      res.status(200).json(cart);
    } catch (error) {
      logger.error(`Error adding item to cart: ${error.message}`, { userId: req.user?.id });
      res.status(error.status || 500).json({
        message: error.message || 'Failed to add item to cart',
      });
    }
  },

  // Remove an item from the cart
  removeItemFromCartController: async (req, res) => {
    try {
      const { error } = Joi.object({
        productId: cartItemSchema.extract('productId'),
      }).validate(req.body);
      if (error) {
        logger.error(`Validation error removing item from cart: ${error.details[0].message}`, {
          userId: req.user?.id,
        });
        return res.status(400).json({ message: error.details[0].message });
      }

      const { productId } = req.body;
      const cart = await CartService.removeItemFromCart(req.user.id, productId, req.user.id);
      logger.info(`Removed item ${productId} from cart for user ${req.user.id}`);
      res.status(200).json(cart);
    } catch (error) {
      logger.error(`Error removing item from cart: ${error.message}`, { userId: req.user?.id });
      res.status(error.status || 500).json({
        message: error.message || 'Failed to remove item from cart',
      });
    }
  },

  // Update item quantity in the cart
  updateCartItemQuantityController: async (req, res) => {
    try {
      const { error } = cartItemSchema.validate(req.body);
      if (error) {
        logger.error(`Validation error updating cart item quantity: ${error.details[0].message}`, {
          userId: req.user?.id,
        });
        return res.status(400).json({ message: error.details[0].message });
      }

      const { productId, quantity } = req.body;
      const cart = await CartService.updateCartItemQuantity(
        req.user.id,
        productId,
        quantity,
        req.user.id
      );
      logger.info(`Updated quantity of item ${productId} in cart for user ${req.user.id}`);
      res.status(200).json(cart);
    } catch (error) {
      logger.error(`Error updating cart item quantity: ${error.message}`, {
        userId: req.user?.id,
      });
      res.status(error.status || 500).json({
        message: error.message || 'Failed to update cart item quantity',
      });
    }
  },

  // Clear the user's cart
  clearCartController: async (req, res) => {
    try {
      await CartService.clearCart(req.user.id, req.user.id);
      logger.info(`Cleared cart for user ${req.user.id}`);
      res.status(200).json({ message: 'Cart cleared successfully' });
    } catch (error) {
      logger.error(`Error clearing cart: ${error.message}`, { userId: req.user?.id });
      res.status(error.status || 500).json({
        message: error.message || 'Failed to clear cart',
      });
    }
  },

  // Get the user's cart
  getUserCartController: async (req, res) => {
    try {
      const { userId } = req.params;
      const { error } = Joi.object({
        userId: Joi.string()
          .required()
          .custom((value, helpers) => {
            if (!require('mongoose').isValidObjectId(value)) {
              return helpers.error('any.invalid');
            }
            return value;
          }, 'MongoDB ObjectId')
          .messages({
            'any.invalid': 'Invalid user ID',
          }),
      }).validate({ userId });
      if (error) {
        logger.error(`Validation error getting user cart: ${error.details[0].message}`, {
          userId: req.user?.id,
        });
        return res.status(400).json({ message: error.details[0].message });
      }

      const cart = await CartService.getUserCart(userId, req.user.id);
      logger.info(`Retrieved cart for user ${userId}`);
      res.status(200).json(cart);
    } catch (error) {
      logger.error(`Error getting user cart: ${error.message}`, { userId: req.user?.id });
      res.status(error.status || 500).json({
        message: error.message || 'Failed to retrieve cart',
      });
    }
  },
};