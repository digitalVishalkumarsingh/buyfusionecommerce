const express = require('express');
const router = express.Router();
const sellerController = require('../controllers/seller.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/verifyToken'); // Ensure correct path

// Seller routes - Ensure that the user is authenticated and has the 'seller' role

// Get Seller Profile
router.get('/profile', verifyToken, authorizeRoles('seller'), sellerController.getSellerProfile);

// Update Seller Profile
router.put('/profile', verifyToken, authorizeRoles('seller'), sellerController.updateSellerProfile);

// Product Management Routes
router.post('/product', verifyToken, authorizeRoles('seller'), sellerController.addProduct);
router.put('/product/:productId', verifyToken, authorizeRoles('seller'), sellerController.updateProduct);
router.get('/products', verifyToken, authorizeRoles('seller'), sellerController.getSellerProducts);

// Order Management Routes
router.get('/orders', verifyToken, authorizeRoles('seller'), sellerController.getSellerOrders);
router.put('/order/:orderId/status', verifyToken, authorizeRoles('seller'), sellerController.updateOrderStatus);

module.exports = router;
