const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { verifyToken, authorizeRoles, verifyAdmin } = require('../middlewares/verifyToken');

// Admin Routes

// Get all users (admin only)
router.get('/users', verifyToken, authorizeRoles(['admin']), adminController.getAllUsers);

// Get all sellers (admin only)
router.get('/sellers', verifyToken, authorizeRoles(['admin']), adminController.getAllSellers);

// Get a seller by ID (admin only)
router.get('/sellers/:id', [
  verifyToken,
  authorizeRoles(['admin']),
  // Optional: Add validation
  // param('id').isInt().withMessage('ID must be an integer'),
  adminController.getSellerById
]);

// Get products for a specific seller (admin only)
router.get('/sellers/:sellerId/products', [
  verifyToken,
  authorizeRoles(['admin']),
  // Optional: Add validation
  // param('sellerId').isInt().withMessage('Seller ID must be an integer'),
  adminController.getSellerProducts
]);

// Get orders for a specific seller (admin only)
router.get('/sellers/:sellerId/orders', [
  verifyToken,
  authorizeRoles(['admin']),
  // Optional: Add validation
  // param('sellerId').isInt().withMessage('Seller ID must be an integer'),
  adminController.getSellerOrders
]);

// Remove a seller (admin only)
router.delete('/sellers/:id', [
  verifyToken,
  authorizeRoles(['admin']),
  // Optional: Add validation
  // param('id').isInt().withMessage('ID must be an integer'),
  adminController.removeSeller
]);

// Update a seller's status (admin only)
router.patch('/sellers/:id/status', [
  verifyToken,
  authorizeRoles(['admin']),
  // Optional: Add validation
  // param('id').isInt().withMessage('ID must be an integer'),
  adminController.updateSellerStatus
]);

// Get system-wide reports (admin only)
router.get('/reports', verifyToken, authorizeRoles(['admin']), adminController.getSystemReports);

// Promote user to seller/vendor (admin only)
router.post('/promote', verifyToken, verifyAdmin, adminController.promoteToSellerOrVendor);

module.exports = router;