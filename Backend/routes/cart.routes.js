const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/verifyToken');
const authorize = require('../middlewares/athorize'); // Fixed typo
const rateLimit = require('express-rate-limit');
const {
  addItemToCartController,
  removeItemFromCartController,
  updateCartItemQuantityController,
  clearCartController,
  getUserCartController,
} = require('../controllers/cart.controller');

/**
 * Rate limiter for cart modification endpoints
 */
const cartModifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per user
  keyGenerator: (req) => req.user.id, // Simplified, as verifyToken ensures req.user
  message: 'Too many cart modification requests, please try again later.',
});

/**
 * Rate limiter for cart retrieval
 */
const cartGetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per user
  keyGenerator: (req) => req.user.id, // Simplified
  message: 'Too many cart retrieval requests, please try again later.',
});

/**
 * @route POST /cart
 * @desc Add an item to the cart
 * @access Private (user)
 */
router.post(
  '/',
  verifyToken,
  authorize(['modify:cart']),
  cartModifyRateLimiter,
  addItemToCartController
);

/**
 * @route DELETE /cart/item
 * @desc Remove an item from the cart
 * @access Private (user)
 */
router.delete(
  '/item',
  verifyToken,
  authorize(['modify:cart']),
  cartModifyRateLimiter,
  removeItemFromCartController
);

/**
 * @route PUT /cart/item
 * @desc Update item quantity in the cart
 * @access Private (user)
 */
router.put(
  '/item',
  verifyToken,
  authorize(['modify:cart']),
  cartModifyRateLimiter,
  updateCartItemQuantityController
);

/**
 * @route DELETE /cart
 * @desc Clear the user's cart
 * @access Private (user)
 */
router.delete(
  '/',
  verifyToken,
  authorize(['modify:cart']),
  cartModifyRateLimiter,
  clearCartController
);

/**
 * @route GET /cart/:userId
 * @desc Get the user's cart
 * @access Private (user)
 */
router.get(
  '/:userId',
  verifyToken,
  authorize(['view:cart']),
  cartGetRateLimiter,
  getUserCartController
);

module.exports = router;