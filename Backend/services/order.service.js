const Order = require('../models/order.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');
const sendEmail = require('../services/emailService');
const winston = require('winston');

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/orderService.log' }),
  ],
});

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

// Create a new order
const createOrder = async (userId, products, shippingAddress, billingAddress, paymentMethod = 'razorpay') => {
  if (!mongoose.isValidObjectId(userId)) {
    throw new BadRequestError('Invalid user ID');
  }
  if (!Array.isArray(products) || products.length === 0) {
    throw new BadRequestError('Products array is required and cannot be empty');
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    let totalAmount = 0;
    const productDetails = [];

    // Validate products and calculate total amount
    for (const item of products) {
      if (!mongoose.isValidObjectId(item.productId)) {
        throw new BadRequestError(`Invalid product ID: ${item.productId}`);
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new BadRequestError(`Invalid quantity for product ${item.productId}`);
      }

      const product = await Product.findById(item.productId).session(session);
      if (!product) {
        throw new NotFoundError(`Product with ID ${item.productId} not found`);
      }
      if (!product.sellerId) {
        throw new BadRequestError(`Product ${item.productId} has no seller`);
      }

      const productPrice = product.price * item.quantity;
      totalAmount += productPrice;

      productDetails.push({
        productId: product._id,
        quantity: item.quantity,
        price: product.price, // Store per-unit price
        sellerId: product.sellerId,
      });
    }

    // Create the order
    const newOrder = new Order({
      userId,
      products: productDetails,
      totalAmount,
      paymentStatus: 'pending',
      status: 'pending',
      shippingAddress: shippingAddress || {},
      billingAddress: billingAddress || {},
      paymentMethod,
    });

    await newOrder.save({ session });

    // Send order confirmation email
    const user = await User.findById(userId).session(session);
    if (user && user.email) {
      const emailHtml = `
        <html>
          <body>
            <h1>Order Confirmation</h1>
            <p>Your order #${newOrder._id} has been successfully created.</p>
            <ul>
              ${productDetails
                .map(
                  (product) =>
                    `<li>${product.quantity} x Product ID ${product.productId} - ₹${product.price * product.quantity}</li>`
                )
                .join('')}
            </ul>
            <p><strong>Total Amount: ₹${totalAmount}</strong></p>
          </body>
        </html>
      `;
      await sendEmail(user.email, 'Order Confirmation', emailHtml);
      logger.info(`Sent order confirmation email to ${user.email} for order ${newOrder._id}`);
    }

    await session.commitTransaction();
    logger.info(`Created order ${newOrder._id} for user ${userId}`);
    return newOrder;
  } catch (error) {
    await session.abortTransaction();
    logger.error(`Error creating order for user ${userId}: ${error.message}`);
    throw error.status ? error : new Error(`Error creating order: ${error.message}`);
  } finally {
    session.endSession();
  }
};

// Get user orders (order history)
const getUserOrders = async (userId, { page = 1, limit = 10 } = {}) => {
  if (!mongoose.isValidObjectId(userId)) {
    throw new BadRequestError('Invalid user ID');
  }
  try {
    const orders = await Order.find({ userId, isDeleted: false })
      .populate('products.productId', 'name price')
      .populate('products.sellerId', 'name')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    logger.info(`Retrieved orders for user ${userId}, page ${page}, limit ${limit}`);
    return orders;
  } catch (error) {
    logger.error(`Error fetching orders for user ${userId}: ${error.message}`);
    throw error.status ? error : new Error(`Error fetching user orders: ${error.message}`);
  }
};

// Get order details by ID
const getOrderDetails = async (userId, orderId) => {
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(orderId)) {
    throw new BadRequestError('Invalid user or order ID');
  }
  try {
    const order = await Order.findOne({ _id: orderId, userId, isDeleted: false })
      .populate('products.productId', 'name price')
      .populate('products.sellerId', 'name')
      .lean();
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    logger.info(`Retrieved order ${orderId} for user ${userId}`);
    return order;
  } catch (error) {
    logger.error(`Error fetching order ${orderId} for user ${userId}: ${error.message}`);
    throw error.status ? error : new Error(`Error fetching order details: ${error.message}`);
  }
};

// Update order status
const updateOrderStatus = async (orderId, status) => {
  if (!mongoose.isValidObjectId(orderId)) {
    throw new BadRequestError('Invalid order ID');
  }
  if (!['pending', 'shipped', 'delivered', 'cancelled'].includes(status)) {
    throw new BadRequestError('Invalid order status');
  }
  try {
    const order = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true, runValidators: true }
    );
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    logger.info(`Updated status of order ${orderId} to ${status}`);
    return order;
  } catch (error) {
    logger.error(`Error updating order ${orderId} status: ${error.message}`);
    throw error.status ? error : new Error(`Error updating order status: ${error.message}`);
  }
};

// Soft delete an order
const deleteOrder = async (orderId) => {
  if (!mongoose.isValidObjectId(orderId)) {
    throw new BadRequestError('Invalid order ID');
  }
  try {
    const order = await Order.findByIdAndUpdate(
      orderId,
      { isDeleted: true },
      { new: true }
    );
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    logger.info(`Soft deleted order ${orderId}`);
    return order;
  } catch (error) {
    logger.error(`Error deleting order ${orderId}: ${error.message}`);
    throw error.status ? error : new Error(`Error deleting order: ${error.message}`);
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrderDetails,
  updateOrderStatus,
  deleteOrder,
};