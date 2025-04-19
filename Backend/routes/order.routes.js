const express = require('express');
const router = express.Router();
const { verifyToken, authorizeRoles } = require('../middlewares/verifyToken');
const { createOrder, updateOrderStatus, deleteOrder } = require('../controllers/order.controller');

/**
 * @route POST /orders
 * @desc Create a new order
 * @access Private (user)
 */
router.post(
  '/',
  verifyToken,
  authorizeRoles('user'),
  createOrder
);

/**
 * @route PUT /orders/:orderId/status
 * @desc Update order status
 * @access Private (admin, seller)
 */
router.put(
  '/:orderId/status',
  verifyToken,
  authorizeRoles('admin', 'seller'),
  updateOrderStatus
);

/**
 * @route DELETE /orders/:orderId
 * @desc Soft delete an order
 * @access Private (admin, seller)
 */
router.delete(
  '/:orderId',
  verifyToken,
  authorizeRoles('admin', 'seller'),
  deleteOrder
);

module.exports = router;