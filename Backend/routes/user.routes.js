const express = require('express');
const router = express.Router();
const { verifyToken, authorizeRoles } = require('../middlewares/verifyToken');
const authorize = require('../middlewares/athorize'); // Corrected from 'athorize'
const { uploadProfilePicture } = require('../middlewares/fileUpload');
const multer = require('multer');

const {
  getUserProfile,
  updateUserProfile,
  getOrderHistory,
  getOrderById,
  addToWishlist,
  removeFromWishlist,
  addToCart,
  removeFromCart,
  updateProfilePicture,
} = require('../controllers/user.controller');

/**
 * Multer error handling middleware
 */
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FORMAT') {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds limit' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files uploaded' });
    }
  }
  if (err.message === 'Cloudinary configuration missing. File uploads are disabled.') {
    return res.status(503).json({ error: err.message });
  }
  return res.status(500).json({ error: 'An unexpected error occurred during file upload' });
};

/**
 * @route GET /profile
 * @desc Get authenticated user's profile
 * @access Private
 */
router.get('/profile', verifyToken, authorize(['read:profile']), getUserProfile);

/**
 * @route PUT /profile
 * @desc Update authenticated user's profile
 * @access Private
 */
router.put('/profile', verifyToken, authorize(['update:profile']), updateUserProfile);

/**
 * @route GET /order-history
 * @desc Get authenticated user's order history
 * @access Private
 */
router.get('/order-history', verifyToken, authorize(['read:orders']), getOrderHistory);

/**
 * @route GET /order/:id
 * @desc Get specific order by ID for authenticated user
 * @access Private
 */
router.get('/order/:id', verifyToken, authorize(['read:orders']), getOrderById);

/**
 * @route POST /wishlist
 * @desc Add product to authenticated user's wishlist
 * @access Private (user, seller, vendor)
 */
router.post(
  '/wishlist',
  verifyToken,
  authorizeRoles('user', 'seller', 'vendor'),
  authorize(['add:wishlist']),
  addToWishlist
);

/**
 * @route DELETE /wishlist
 * @desc Remove product from authenticated user's wishlist
 * @access Private (user, seller, vendor)
 * @query {string} productId - ID of the product to remove
 */
router.delete(
  '/wishlist',
  verifyToken,
  authorizeRoles('user', 'seller', 'vendor'),
  authorize(['remove:wishlist']),
  removeFromWishlist
);

/**
 * @route POST /cart
 * @desc Add product to authenticated user's cart
 * @access Private (user, seller)
 */
router.post(
  '/cart',
  verifyToken,
  authorizeRoles('user', 'seller'),
  authorize(['add:cart']),
  addToCart
);

/**
 * @route DELETE /cart
 * @desc Remove product from authenticated user's cart
 * @access Private (user, seller)
 * @query {string} productId - ID of the product to remove
 */
router.delete(
  '/cart',
  verifyToken,
  authorizeRoles('user', 'seller'),
  authorize(['remove:cart']),
  removeFromCart
);

/**
 * @route PUT /profile/picture
 * @desc Update authenticated user's profile picture
 * @access Private (user)
 */
router.put(
  '/profile/picture',
  verifyToken,
  authorizeRoles('user'),
  authorize(['update:profile']),
  uploadProfilePicture,
  handleMulterError,
  updateProfilePicture
);

module.exports = router;