
const mongoose = require('mongoose');
const winston = require('winston');
const Product = require('../models/product.model');
const User = require('../models/user.model');

const { cleanupFailedUpload } = require('../middlewares/fileUpload');

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
    new winston.transports.File({ filename: 'logs/productService.log' }),
  ],
});

class ProductService {
  /**
   * Add a new product with images.
   * @param {Object} productData - Product data (name, price, etc.).
   * @param {string} userId - User ID (seller).
   * @param {Object[]} files - Uploaded image files (from fileUpload.js).
   * @returns {Object} Created product document.
   */
  async addProduct(productData, userId, files = []) {
    if (!mongoose.isValidObjectId(userId)) {
      logger.error(`Invalid user ID: ${userId}`);
      throw new BadRequestError('Invalid user ID');
    }

    const {
      name,
      price,
      discountPrice,
      category,
      subcategories,
      description,
      stock,
      sellerId,
      size,
      brand,
      color,
      isActive,
    } = productData;

    // Validate required fields
    if (!name || !price || !category || !stock || !sellerId) {
      logger.error('Missing required fields for product creation', { userId });
      throw new BadRequestError('Missing required fields');
    }
    if (!mongoose.isValidObjectId(sellerId)) {
      logger.error(`Invalid seller ID: ${sellerId}`, { userId });
      throw new BadRequestError('Invalid seller ID');
    }
    if (!mongoose.isValidObjectId(category)) {
      logger.error(`Invalid category ID: ${category}`, { userId });
      throw new BadRequestError('Invalid category ID');
    }
    if (subcategories) {
      if (!Array.isArray(subcategories) || subcategories.some((id) => !mongoose.isValidObjectId(id))) {
        logger.error('Invalid subcategory IDs', { userId });
        throw new BadRequestError('Invalid subcategory IDs');
      }
    }
    if (price < 0 || stock < 0 || (discountPrice && discountPrice < 0)) {
      logger.error('Invalid numeric values for product', { userId });
      throw new BadRequestError('Price, discountPrice, and stock must be non-negative');
    }
    if (files.length > 4) {
      logger.error(`Too many images: ${files.length}`, { userId });
      await Promise.all(files.map((file) => cleanupFailedUpload(file.filename)));
      throw new BadRequestError('Maximum 4 images allowed');
    }

    // Verify seller and category
    const [seller, categoryDoc] = await Promise.all([
      User.findById(sellerId).lean(),
      Category.findById(category).lean(),
    ]);
    if (!seller) {
      logger.warn(`Seller not found: ${sellerId}`, { userId });
      throw new NotFoundError('Seller not found');
    }
    if (!categoryDoc) {
      logger.warn(`Category not found: ${category}`, { userId });
      throw new NotFoundError('Category not found');
    }
    if (subcategories && subcategories.length > 0) {
      const subcategoryDocs = await Subcategory.find({ _id: { $in: subcategories } }).lean();
      if (subcategoryDocs.length !== subcategories.length) {
        logger.warn('Some subcategories not found', { userId, subcategories });
        throw new NotFoundError('One or more subcategories not found');
      }
    }
    if (sellerId !== userId) {
      logger.warn(`Unauthorized product creation attempt by user ${userId} for seller ${sellerId}`);
      throw new ForbiddenError('Unauthorized to add product for this seller');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const imageUrls = files.map((file) => ({
        public_id: file.filename,
        url: file.path,
      }));

      const newProduct = new Product({
        name: name.trim(),
        price,
        discountPrice: discountPrice || null,
        category,
        subcategories: subcategories || [],
        description: description?.trim(),
        stock,
        seller: sellerId,
        images: imageUrls,
        size: size?.trim(),
        brand: brand?.trim(),
        color: color?.trim(),
        isActive: isActive !== undefined ? isActive : true,
        isDeleted: false,
      });

      await newProduct.save({ session });
      await session.commitTransaction();
      logger.info(`Created product ${newProduct._id} by user ${userId}`);
      return newProduct;
    } catch (error) {
      await session.abortTransaction();
      if (files.length > 0) {
        await Promise.all(files.map((file) => cleanupFailedUpload(file.filename)));
      }
      logger.error(`Error creating product: ${error.message}`, { userId });
      throw error.status ? error : new BadRequestError(error.message || 'Failed to create product');
    } finally {
      session.endSession();
    }
  }

  /**
   * Fetch product by ID.
   * @param {string} id - Product ID.
   * @returns {Object} Product document.
   */
  async getProductById(id) {
    if (!mongoose.isValidObjectId(id)) {
      logger.error(`Invalid product ID: ${id}`);
      throw new BadRequestError('Invalid product ID');
    }
    const product = await Product.findOne({ _id: id, isDeleted: false, isActive: true })
      .populate('reviews.user', 'name')
      .populate('category', 'name')
      .populate('subcategories', 'name')
      .lean();
    if (!product) {
      logger.warn(`Product not found: ${id}`);
      throw new NotFoundError('Product not found');
    }
    logger.info(`Retrieved product ${id}`);
    return product;
  }

  /**
   * Update product by ID.
   * @param {string} id - Product ID.
   * @param {Object} updateData - Product update data.
   * @param {string} userId - User ID.
   * @param {Object[]} files - Uploaded image files (from fileUpload.js).
   * @returns {Object} Updated product document.
   */
  async updateProduct(id, updateData, userId, files = []) {
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) {
      logger.error(`Invalid ID: product ${id}, user ${userId}`);
      throw new BadRequestError('Invalid product or user ID');
    }

    // Validate updateData
    const {
      name,
      price,
      discountPrice,
      category,
      subcategories,
      description,
      stock,
      size,
      brand,
      color,
      isActive,
    } = updateData;
    if (name && !name.trim()) throw new BadRequestError('Name cannot be empty');
    if (price && (isNaN(price) || price < 0)) throw new BadRequestError('Price must be a non-negative number');
    if (discountPrice && (isNaN(discountPrice) || discountPrice < 0)) throw new BadRequestError('Discount price must be a non-negative number');
    if (stock && (isNaN(stock) || stock < 0)) throw new BadRequestError('Stock must be a non-negative integer');
    if (category && !mongoose.isValidObjectId(category)) throw new BadRequestError('Invalid category ID');
    if (subcategories) {
      if (!Array.isArray(subcategories) || subcategories.some((id) => !mongoose.isValidObjectId(id))) {
        throw new BadRequestError('Invalid subcategory IDs');
      }
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const product = await Product.findOne({ _id: id, isDeleted: false }).session(session);
      if (!product) {
        logger.warn(`Product not found: ${id}`);
        throw new NotFoundError('Product not found');
      }

      // Authorization: seller or update:product permission
      if (product.seller.toString() !== userId) {
        logger.warn(`Unauthorized product update attempt by user ${userId} for product ${id}`);
        throw new ForbiddenError('Unauthorized to update this product');
      }

      // Validate category and subcategories
      if (category) {
        const categoryDoc = await Category.findById(category).lean();
        if (!categoryDoc) throw new NotFoundError('Category not found');
      }
      if (subcategories && subcategories.length > 0) {
        const subcategoryDocs = await Subcategory.find({ _id: { $in: subcategories } }).lean();
        if (subcategoryDocs.length !== subcategories.length) {
          throw new NotFoundError('One or more subcategories not found');
        }
      }

      // Update fields
      product.name = name ? name.trim() : product.name;
      product.price = price !== undefined ? price : product.price;
      product.discountPrice = discountPrice !== undefined ? discountPrice : product.discountPrice;
      product.category = category || product.category;
      product.subcategories = subcategories || product.subcategories;
      product.description = description ? description.trim() : product.description;
      product.stock = stock !== undefined ? stock : product.stock;
      product.size = size ? size.trim() : product.size;
      product.brand = brand ? brand.trim() : product.brand;
      product.color = color ? color.trim() : product.color;
      product.isActive = isActive !== undefined ? isActive : product.isActive;

      // Handle image uploads
      if (files.length > 0) {
        if (files.length > 4) {
          logger.error(`Too many images: ${files.length}`, { userId });
          await Promise.all(files.map((file) => cleanupFailedUpload(file.filename)));
          throw new BadRequestError('Maximum 4 images allowed');
        }
        const imageUrls = files.map((file) => ({
          public_id: file.filename,
          url: file.path,
        }));
        product.images = imageUrls; // Replace existing images
        logger.info(`Updated images for product ${id}`, { imageCount: files.length });
      }

      await product.save({ session });
      await session.commitTransaction();
      logger.info(`Updated product ${id} by user ${userId}`);
      return product;
    } catch (error) {
      await session.abortTransaction();
      if (files.length > 0) {
        await Promise.all(files.map((file) => cleanupFailedUpload(file.filename)));
      }
      logger.error(`Error updating product ${id}: ${error.message}`, { userId });
      throw error.status ? error : new BadRequestError(error.message || 'Failed to update product');
    } finally {
      session.endSession();
    }
  }

  /**
   * Delete product by ID (soft delete).
   * @param {string} id - Product ID.
   * @param {string} userId - User ID.
   * @returns {Object} Success message.
   */
  async deleteProduct(id, userId) {
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) {
      logger.error(`Invalid ID: product ${id}, user ${userId}`);
      throw new BadRequestError('Invalid product or user ID');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const product = await Product.findOne({ _id: id, isDeleted: false }).session(session);
      if (!product) {
        logger.warn(`Product not found: ${id}`);
        throw new NotFoundError('Product not found');
      }

      // Authorization: seller or delete:product permission
      if (product.seller.toString() !== userId) {
        logger.warn(`Unauthorized product deletion attempt by user ${userId} for product ${id}`);
        throw new ForbiddenError('Unauthorized to delete this product');
      }

      // Soft delete
      product.isDeleted = true;
      product.isActive = false;

      // Clean up images
      if (product.images?.length > 0) {
        await Promise.all(product.images.map((img) => cleanupFailedUpload(img.public_id)));
        product.images = [];
      }

      await product.save({ session });
      await session.commitTransaction();
      logger.info(`Soft deleted product ${id} by user ${userId}`);
      return { message: 'Product deleted successfully' };
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error deleting product ${id}: ${error.message}`, { userId });
      throw error.status ? error : new BadRequestError('Failed to delete product');
    } finally {
      session.endSession();
    }
  }

  /**
   * Add a review to a product.
   * @param {string} productId - Product ID.
   * @param {Object} reviewData - Review data (rating, comment).
   * @param {string} userId - User ID.
   * @returns {Object} Updated product document.
   */
  async addReview(productId, reviewData, userId) {
    if (!mongoose.isValidObjectId(productId) || !mongoose.isValidObjectId(userId)) {
      logger.error(`Invalid ID: product ${productId}, user ${userId}`);
      throw new BadRequestError('Invalid product or user ID');
    }

    // Validate reviewData
    const { rating, comment } = reviewData;
    if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
      logger.error(`Invalid rating: ${rating}`, { userId });
      throw new BadRequestError('Rating must be an integer between 0 and 5');
    }
    if (comment && !comment.trim()) {
      logger.error('Empty comment', { userId });
      throw new BadRequestError('Comment cannot be empty');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const product = await Product.findOne({ _id: productId, isDeleted: false }).session(session);
      if (!product) {
        logger.warn(`Product not found: ${productId}`);
        throw new NotFoundError('Product not found');
      }

      // Check for existing review
      if (product.reviews.some((review) => review.user.toString() === userId)) {
        logger.warn(`User ${userId} already reviewed product ${productId}`);
        throw new BadRequestError('User already reviewed this product');
      }

      const newReview = {
        user: userId,
        rating,
        comment: comment ? comment.trim() : undefined,
        createdAt: new Date(),
      };

      product.reviews.push(newReview);
      await product.save({ session });
      await product.updateRating().session(session); // Update average rating
      await session.commitTransaction();
      logger.info(`Added review to product ${productId} by user ${userId}`);
      return await Product.findById(productId)
        .populate('reviews.user', 'name')
        .populate('category', 'name')
        .populate('subcategories', 'name')
        .lean();
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error adding review to product ${productId}: ${error.message}`, { userId });
      throw error.status ? error : new BadRequestError('Failed to add review');
    } finally {
      session.endSession();
    }
  }

  /**
   * Update a review for a product.
   * @param {string} productId - Product ID.
   * @param {string} reviewId - Review ID.
   * @param {Object} reviewData - Updated review data.
   * @param {string} userId - User ID.
   * @returns {Object} Updated product document.
   */
  async updateReview(productId, reviewId, reviewData, userId) {
    if (
      !mongoose.isValidObjectId(productId) ||
      !mongoose.isValidObjectId(reviewId) ||
      !mongoose.isValidObjectId(userId)
    ) {
      logger.error(`Invalid ID: product ${productId}, review ${reviewId}, user ${userId}`);
      throw new BadRequestError('Invalid product, review, or user ID');
    }

    // Validate reviewData
    const { rating, comment } = reviewData;
    if (rating && (!Number.isInteger(rating) || rating < 0 || rating > 5)) {
      logger.error(`Invalid rating: ${rating}`, { userId });
      throw new BadRequestError('Rating must be an integer between 0 and 5');
    }
    if (comment && !comment.trim()) {
      logger.error('Empty comment', { userId });
      throw new BadRequestError('Comment cannot be empty');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const product = await Product.findOne({ _id: productId, isDeleted: false }).session(session);
      if (!product) {
        logger.warn(`Product not found: ${productId}`);
        throw new NotFoundError('Product not found');
      }

      const review = product.reviews.id(reviewId);
      if (!review) {
        logger.warn(`Review not found: ${reviewId}`);
        throw new NotFoundError('Review not found');
      }

      if (review.user.toString() !== userId) {
        logger.warn(`Unauthorized review update attempt by user ${userId} for review ${reviewId}`);
        throw new ForbiddenError('Unauthorized to update this review');
      }

      review.rating = rating !== undefined ? rating : review.rating;
      review.comment = comment ? comment.trim() : review.comment;

      await product.save({ session });
      await product.updateRating().session(session); // Update average rating
      await session.commitTransaction();
      logger.info(`Updated review ${reviewId} for product ${productId} by user ${userId}`);
      return await Product.findById(productId)
        .populate('reviews.user', 'name')
        .populate('category', 'name')
        .populate('subcategories', 'name')
        .lean();
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error updating review ${reviewId} for product ${productId}: ${error.message}`, { userId });
      throw error.status ? error : new BadRequestError('Failed to update review');
    } finally {
      session.endSession();
    }
  }

  /**
   * Delete a review from a product.
   * @param {string} productId - Product ID.
   * @param {string} reviewId - Review ID.
   * @param {string} userId - User ID.
   * @returns {Object} Success message.
   */
  async deleteReview(productId, reviewId, userId) {
    if (
      !mongoose.isValidObjectId(productId) ||
      !mongoose.isValidObjectId(reviewId) ||
      !mongoose.isValidObjectId(userId)
    ) {
      logger.error(`Invalid ID: product ${productId}, review ${reviewId}, user ${userId}`);
      throw new BadRequestError('Invalid product, review, or user ID');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const product = await Product.findOne({ _id: productId, isDeleted: false }).session(session);
      if (!product) {
        logger.warn(`Product not found: ${productId}`);
        throw new NotFoundError('Product not found');
      }

      const review = product.reviews.id(reviewId);
      if (!review) {
        logger.warn(`Review not found: ${reviewId}`);
        throw new NotFoundError('Review not found');
      }

      if (review.user.toString() !== userId) {
        logger.warn(`Unauthorized review deletion attempt by user ${userId} for review ${reviewId}`);
        throw new ForbiddenError('Unauthorized to delete this review');
      }

      product.reviews.pull(reviewId);
      await product.save({ session });
      await product.updateRating().session(session); // Update average rating
      await session.commitTransaction();
      logger.info(`Deleted review ${reviewId} from product ${productId} by user ${userId}`);
      return { message: 'Review deleted successfully' };
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error deleting review ${reviewId} from product ${productId}: ${error.message}`, { userId });
      throw error.status ? error : new BadRequestError('Failed to delete review');
    } finally {
      session.endSession();
    }
  }
}

module.exports = new ProductService();
