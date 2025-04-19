
const Joi = require('joi');
const mongoose = require('mongoose');
const winston = require('winston');
const ProductService = require('../services/product.service');
const Product = require('../models/product.model');
const { cleanupFailedUpload } = require('../middlewares/fileUpload');

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/productController.log' }),
  ],
});

// Validation schemas
const productSchema = Joi.object({
  name: Joi.string().trim().min(2).required(),
  price: Joi.number().min(0).required(),
  discountPrice: Joi.number().min(0).allow(null).optional(),
  category: Joi.string().custom((value, helpers) => {
    if (!mongoose.isValidObjectId(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }).required(),
  subcategories: Joi.array().items(Joi.string().custom((value, helpers) => {
    if (!mongoose.isValidObjectId(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  })).optional(),
  description: Joi.string().trim().optional(),
  stock: Joi.number().integer().min(0).required(),
  sellerId: Joi.string().custom((value, helpers) => {
    if (!mongoose.isValidObjectId(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }).required(),
  size: Joi.string().trim().optional(),
  brand: Joi.string().trim().optional(),
  color: Joi.string().trim().optional(),
  isActive: Joi.boolean().optional(),
});

const reviewSchema = Joi.object({
  rating: Joi.number().integer().min(0).max(5).required(),
  comment: Joi.string().trim().min(1).optional(),
});

const filterSchema = Joi.object({
  category: Joi.string().custom((value, helpers) => {
    if (!mongoose.isValidObjectId(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }).optional(),
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
  brand: Joi.string().trim().optional(),
  size: Joi.string().trim().optional(),
  color: Joi.string().trim().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().valid('price', '-price', 'name', '-name').optional(),
});

const searchSchema = Joi.object({
  search: Joi.string().trim().min(1).required(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

/**
 * Add a product with images.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
exports.addProductWithImage = async (req, res) => {
  try {
    const { error } = productSchema.validate(req.body);
    if (error) {
      logger.error(`Validation error adding product: ${error.details[0].message}`, { userId: req.user?.id });
      return res.status(400).json({ message: error.details[0].message });
    }
    const product = await ProductService.addProduct(req.body, req.user.id, req.files);
    logger.info(`Added product ${product._id} by user ${req.user.id}`);
    res.status(201).json(product);
  } catch (error) {
    logger.error(`Error adding product: ${error.message}`, { userId: req.user?.id });
    res.status(error.status || 500).json({ message: error.message || 'Failed to add product' });
  }
};

/**
 * Get all products with pagination.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
exports.getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { error } = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
    }).validate({ page, limit });
    if (error) {
      logger.error(`Validation error getting products: ${error.details[0].message}`);
      return res.status(400).json({ message: error.details[0].message });
    }

    const products = await Product.find({ isDeleted: false, isActive: true })
      .populate('reviews.user', 'name')
      .populate('category', 'name')
      .populate('subcategories', 'name')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    logger.info(`Retrieved products, page ${page}, limit ${limit}`);
    res.status(200).json(products);
  } catch (error) {
    logger.error(`Error getting products: ${error.message}`);
    res.status(500).json({ message: 'Failed to retrieve products' });
  }
};

/**
 * Get product by ID.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      logger.error(`Invalid product ID: ${id}`);
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    const product = await ProductService.getProductById(id);
    logger.info(`Retrieved product ${id}`);
    res.status(200).json(product);
  } catch (error) {
    logger.error(`Error getting product ${req.params.id}: ${error.message}`);
    res.status(error.status || 500).json({ message: error.message || 'Failed to retrieve product' });
  }
};

/**
 * Update product by ID.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      logger.error(`Invalid product ID: ${id}`, { userId: req.user?.id });
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    const { error } = productSchema.optional().validate(req.body);
    if (error) {
      logger.error(`Validation error updating product: ${error.details[0].message}`, { userId: req.user.id });
      return res.status(400).json({ message: error.details[0].message });
    }
    const updatedProduct = await ProductService.updateProduct(id, req.body, req.user.id, req.files);
    logger.info(`Updated product ${id} by user ${req.user.id}`);
    res.status(200).json({ message: 'Product updated successfully', updatedProduct });
  } catch (error) {
    logger.error(`Error updating product ${req.params.id}: ${error.message}`, { userId: req.user?.id });
    res.status(error.status || 500).json({ message: error.message || 'Failed to update product' });
  }
};

/**
 * Delete product by ID.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      logger.error(`Invalid product ID: ${id}`, { userId: req.user?.id });
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    const result = await ProductService.deleteProduct(id, req.user.id);
    logger.info(`Deleted product ${id} by user ${req.user.id}`);
    res.status(200).json(result);
  } catch (error) {
    logger.error(`Error deleting product ${req.params.id}: ${error.message}`, { userId: req.user?.id });
    res.status(error.status || 500).json({ message: error.message || 'Failed to delete product' });
  }
};

/**
 * Get products by filter (category, price, brand, size, color).
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
exports.getProductsByFilter = async (req, res) => {
  try {
    const { error, value } = filterSchema.validate(req.query);
    if (error) {
      logger.error(`Validation error filtering products: ${error.details[0].message}`);
      return res.status(400).json({ message: error.details[0].message });
    }

    const { category, minPrice, maxPrice, brand, size, color, page, limit, sort } = value;
    const query = { isDeleted: false, isActive: true };
    if (category) query.category = category;
    if (minPrice || maxPrice) query.price = {};
    if (minPrice) query.price.$gte = minPrice;
    if (maxPrice) query.price.$lte = maxPrice;
    if (brand) query.brand = brand;
    if (size) query.size = size;
    if (color) query.color = color;

    const products = await Product.find(query)
      .populate('reviews.user', 'name')
      .populate('category', 'name')
      .populate('subcategories', 'name')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    logger.info(`Filtered products`, { query, page, limit });
    res.status(200).json(products);
  } catch (error) {
    logger.error(`Error filtering products: ${error.message}`);
    res.status(500).json({ message: 'Failed to filter products' });
  }
};

/**
 * Search products by name or description.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
exports.searchProducts = async (req, res) => {
  try {
    const { error, value } = searchSchema.validate(req.query);
    if (error) {
      logger.error(`Validation error searching products: ${error.details[0].message}`);
      return res.status(400).json({ message: error.details[0].message });
    }

    const { search, page, limit } = value;
    const products = await Product.find({
      $and: [
        { isDeleted: false, isActive: true },
        {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
          ],
        },
      ],
    })
      .populate('reviews.user', 'name')
      .populate('category', 'name')
      .populate('subcategories', 'name')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    logger.info(`Searched products for query: ${search}`, { page, limit });
    res.status(200).json(products);
  } catch (error) {
    logger.error(`Error searching products: ${error.message}`);
    res.status(500).json({ message: 'Failed to search products' });
  }
};

/**
 * Get all reviews for a product.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
exports.getReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!mongoose.isValidObjectId(productId)) {
      logger.error(`Invalid product ID: ${productId}`);
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    const product = await Product.findOne({ _id: productId, isDeleted: false })
      .populate('reviews.user', 'name')
      .lean();
    if (!product) {
      logger.warn(`Product not found: ${productId}`);
      return res.status(404).json({ message: 'Product not found' });
    }
    logger.info(`Retrieved reviews for product ${productId}`);
    res.status(200).json(product.reviews);
  } catch (error) {
    logger.error(`Error getting reviews for product ${req.params.productId}: ${error.message}`);
    res.status(500).json({ message: 'Failed to retrieve reviews' });
  }
};

/**
 * Add a review for a product.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
exports.addReview = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!mongoose.isValidObjectId(productId)) {
      logger.error(`Invalid product ID: ${productId}`, { userId: req.user?.id });
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    const { error } = reviewSchema.validate(req.body);
    if (error) {
      logger.error(`Validation error adding review: ${error.details[0].message}`, { userId: req.user.id });
      return res.status(400).json({ message: error.details[0].message });
    }
    const product = await ProductService.addReview(productId, req.body, req.user.id);
    logger.info(`Added review to product ${productId} by user ${req.user.id}`);
    res.status(201).json(product);
  } catch (error) {
    logger.error(`Error adding review to product ${req.params.productId}: ${error.message}`, { userId: req.user?.id });
    res.status(error.status || 500).json({ message: error.message || 'Failed to add review' });
  }
};

/**
 * Update a review for a product.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
exports.updateReview = async (req, res) => {
  try {
    const { productId, reviewId } = req.params;
    if (!mongoose.isValidObjectId(productId) || !mongoose.isValidObjectId(reviewId)) {
      logger.error(`Invalid ID: product ${productId}, review ${reviewId}`, { userId: req.user?.id });
      return res.status(400).json({ message: 'Invalid product or review ID' });
    }
    const { error } = reviewSchema.validate(req.body);
    if (error) {
      logger.error(`Validation error updating review: ${error.details[0].message}`, { userId: req.user.id });
      return res.status(400).json({ message: error.details[0].message });
    }
    const product = await ProductService.updateReview(productId, reviewId, req.body, req.user.id);
    logger.info(`Updated review ${reviewId} for product ${productId} by user ${req.user.id}`);
    res.status(200).json(product);
  } catch (error) {
    logger.error(`Error updating review ${req.params.reviewId} for product ${req.params.productId}: ${error.message}`, { userId: req.user?.id });
    res.status(error.status || 500).json({ message: error.message || 'Failed to update review' });
  }
};

/**
 * Delete a review for a product.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
exports.deleteReview = async (req, res) => {
  try {
    const { productId, reviewId } = req.params;
    if (!mongoose.isValidObjectId(productId) || !mongoose.isValidObjectId(reviewId)) {
      logger.error(`Invalid ID: product ${productId}, review ${reviewId}`, { userId: req.user?.id });
      return res.status(400).json({ message: 'Invalid product or review ID' });
    }
    const result = await ProductService.deleteReview(productId, reviewId, req.user.id);
    logger.info(`Deleted review ${reviewId} from product ${productId} by user ${req.user.id}`);
    res.status(200).json(result);
  } catch (error) {
    logger.error(`Error deleting review ${req.params.reviewId} from product ${req.params.productId}: ${error.message}`, { userId: req.user?.id });
    res.status(error.status || 500).json({ message: error.message || 'Failed to delete review' });
  }
};
