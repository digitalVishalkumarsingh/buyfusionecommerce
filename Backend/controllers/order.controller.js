const OrderService = require('../services/order.service');

// Create a new order
exports.createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { products, shippingAddress, billingAddress, paymentMethod } = req.body;
    const order = await OrderService.createOrder(userId, products, shippingAddress, billingAddress, paymentMethod);
    res.status(201).json({ message: 'Order created successfully', order });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

// Update order status (admin/seller)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const order = await OrderService.updateOrderStatus(orderId, status);
    res.status(200).json({ message: 'Order status updated', order });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

// Delete an order (admin/seller)
exports.deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await OrderService.deleteOrder(orderId);
    res.status(200).json({ message: 'Order deleted successfully', order });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};