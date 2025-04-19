// payment.service.js

require('dotenv').config();
const Razorpay = require('razorpay');
const Order = require('../models/order.model'); // Ensure correct path to your Order model

// Initialize Razorpay instance
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,  // Your Razorpay Key ID
  key_secret: process.env.RAZORPAY_KEY_SECRET  // Your Razorpay Key Secret
});

// Create an order in Razorpay
const createOrder = async (userId, products, totalAmount) => {
  try {
    const options = {
      amount: totalAmount * 100, // Razorpay accepts amount in paise (smallest unit of INR)
      currency: 'INR',
      receipt: `order_rcptid_${userId}_${new Date().getTime()}`,
      notes: {
        userId,
        products,
      },
    };

    // Create the order using Razorpay API
    const razorpayOrder = await razorpayInstance.orders.create(options);
    return razorpayOrder;
  } catch (error) {
    throw new Error('Error creating Razorpay order: ' + error.message);
  }
};

// Verify payment signature
const verifyPayment = async (paymentData, razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
  const crypto = require('crypto');
  const keySecret = process.env.RAZORPAY_KEY_SECRET; // Razorpay secret key

  // Generate the signature for verification
  const hmac = crypto.createHmac('sha256', keySecret);
  hmac.update(razorpayOrderId + "|" + razorpayPaymentId);
  const generatedSignature = hmac.digest('hex');

  // Compare the generated signature with the received signature
  if (generatedSignature === razorpaySignature) {
    return true; // Payment is verified
  }
  return false; // Payment is not verified
};

// Update the payment status in the database (e.g., completed/failed)
const updatePaymentStatus = async (razorpayOrderId, status) => {
  try {
    const order = await Order.findOneAndUpdate(
      { razorpayOrderId },
      { paymentStatus: status },
      { new: true } // Return the updated document
    );
    return order;
  } catch (error) {
    throw new Error('Error updating payment status: ' + error.message);
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  updatePaymentStatus,
};
