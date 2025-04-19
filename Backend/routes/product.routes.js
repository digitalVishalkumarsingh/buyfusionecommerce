
const express = require('express');
const router = express.Router();
const { verifyToken, authorizeRoles } = require('../middlewares/verifyToken');
const authorize = require('../middlewares/athorize');
const { uploadProductImage } = require('../middlewares/fileUpload');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const {
  addProductWithImage,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductsByFilter,
  searchProducts,
  getReviews,
  addReview,
  updateReview,
  deleteReview,
} = require('../controllers/product.controller');

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
  next(err);
};

/**
 * Rate limiter for review endpoints
 */
const reviewRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 reviews per user
  keyGenerator: (req) => req.user?.id || req.ip,
  message: 'Too many review requests, please try again later.',
});

/**
 * @route POST /products
 * @desc Add a new product with images
 * @access Private (seller, admin)
 */
router.post(
  '/',
  verifyToken,
  authorize(['add:product']),
  uploadProductImage,
  handleMulterError,
  addProductWithImage
);

/**
 * @route GET /products
 * @desc Get all products with pagination
 * @access Public
 */
router.get('/', getProducts);

/**
 * @route GET /products/:id
 * @desc Get product by ID
 * @access Public
 */
router.get('/:id', getProductById);

/**
 * @route PUT /products/:id
 * @desc Update product by ID
 * @access Private (seller, admin)
 */
router.put(
  '/:id',
  verifyToken,
  authorize(['update:product']),
  uploadProductImage,
  handleMulterError,
  updateProduct
);

/**
 * @route DELETE /products/:id
 * @desc Delete product by ID
 * @access Private (seller, admin)
 */
router.delete('/:id', verifyToken, authorize(['delete:product']), deleteProduct);

/**
 * @route GET /products/filter
 * @desc Filter products by category, price, brand, size, color
 * @access Public
 */
router.get('/filter', getProductsByFilter);

/**
 * @route GET /products/search
 * @desc Search products by name or description
 * @access Public
 */
router.get('/search', searchProducts);

/**
 * @route GET /products/:productId/reviews
 * @desc Get all reviews for a product
 * @access Public
 */
router.get('/:productId/reviews', getReviews);

/**
 * @route POST /products/:productId/reviews
 * @desc Add a review to a product
 * @access Private (user)
 */
router.post(
  '/:productId/reviews',
  verifyToken,
  authorize(['add:review']),
  reviewRateLimiter,
  addReview
);

/**
 * @route PUT /products/:productId/reviews/:reviewId
 * @desc Update a review for a product
 * @access Private (user)
 */
router.put(
  '/:productId/reviews/:reviewId',
  verifyToken,
  authorize(['update:review']),
  reviewRateLimiter,
  updateReview
);

/**
 * @route DELETE /products/:productId/reviews/:reviewId
 * @desc Delete a review from a product
 * @access Private (user)
 */
router.delete(
  '/:productId/reviews/:reviewId',
  verifyToken,
  authorize(['delete:review']),
  reviewRateLimiter,
  deleteReview
);

module.exports = router;
