const adminService = require('../services/admin.service');

// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await adminService.getAllUsers();
    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'No users found' });
    }
    res.status(200).json(users);
  } catch (error) {
    console.error('Error in getAllUsers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all sellers (admin only)
exports.getAllSellers = async (req, res) => {
  try {
    const sellers = await adminService.getAllSellers();
    if (!sellers || sellers.length === 0) {
      return res.status(404).json({ error: 'No sellers found' });
    }
    res.status(200).json(sellers);
  } catch (error) {
    console.error('Error in getAllSellers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get a seller by ID (admin only)
exports.getSellerById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid seller ID' });
    }
    const seller = await adminService.getSellerById(id);
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }
    res.status(200).json(seller);
  } catch (error) {
    console.error('Error in getSellerById:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get products for a specific seller (admin only)
exports.getSellerProducts = async (req, res) => {
  try {
    const { sellerId } = req.params;
    if (!sellerId || isNaN(sellerId)) {
      return res.status(400).json({ error: 'Invalid seller ID' });
    }
    const products = await adminService.getSellerProducts(sellerId);
    if (!products || products.length === 0) {
      return res.status(404).json({ error: 'No products found for this seller' });
    }
    res.status(200).json(products);
  } catch (error) {
    console.error('Error in getSellerProducts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get orders for a specific seller (admin only)
exports.getSellerOrders = async (req, res) => {
  try {
    const { sellerId } = req.params;
    if (!sellerId || isNaN(sellerId)) {
      return res.status(400).json({ error: 'Invalid seller ID' });
    }
    const orders = await adminService.getSellerOrders(sellerId);
    if (!orders || orders.length === 0) {
      return res.status(404).json({ error: 'No orders found for this seller' });
    }
    res.status(200).json(orders);
  } catch (error) {
    console.error('Error in getSellerOrders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Remove a seller (admin only)
exports.removeSeller = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid seller ID' });
    }
    const result = await adminService.removeSeller(id);
    if (!result) {
      return res.status(404).json({ error: 'Seller not found' });
    }
    res.status(204).json({ message: 'Seller removed successfully' }); // No content on success
  } catch (error) {
    console.error('Error in removeSeller:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update a seller's status (admin only)
exports.updateSellerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid seller ID' });
    }
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' });
    }
    const seller = await adminService.updateSellerStatus(id, isActive);
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }
    res.status(200).json(seller);
  } catch (error) {
    console.error('Error in updateSellerStatus:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get system-wide reports (admin only)
exports.getSystemReports = async (req, res) => {
  try {
    const reports = await adminService.getSystemReports();
    if (!reports || Object.keys(reports).length === 0) {
      return res.status(404).json({ error: 'No reports available' });
    }
    res.status(200).json(reports);
  } catch (error) {
    console.error('Error in getSystemReports:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Promote user to seller or vendor (admin only)
exports.promoteToSellerOrVendor = async (req, res) => {
  try {
    const { userId, newRole, storeName, storeDescription } = req.body;
    if (!userId || !newRole || (newRole === 'seller' && (!storeName || !storeDescription))) {
      return res.status(400).json({ error: 'User ID, role, and seller details (if applicable) are required' });
    }
    if (!['seller', 'vendor'].includes(newRole)) {
      return res.status(400).json({ error: 'Role must be "seller" or "vendor"' });
    }
    const result = await adminService.promoteToSellerOrVendor(userId, newRole, storeName, storeDescription);
    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ message: `User promoted to ${newRole} successfully`, userId: result.userId });
  } catch (error) {
    console.error('Error in promoteToSellerOrVendor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};