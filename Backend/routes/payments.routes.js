const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');

// Route to create an order
router.post('/create-order', paymentController.createOrder);

// Route to verify payment
router.post('/verify-payment', paymentController.verifyPayment);

// Route to get order details
router.get('/order-details/:orderId', paymentController.getOrderDetails);

module.exports = router;
