const UserService = require('../services/user.service');

// Get user profile
exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await UserService.getUserProfile(userId);
    res.status(200).json(profile);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await UserService.updateUserProfile(userId, req.body);
    res.status(200).json(profile);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

// Get order history
exports.getOrderHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, limit } = req.query;
    const orders = await UserService.getUserOrders(userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
    });
    res.status(200).json(orders);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

// Get order by ID
exports.getOrderById = async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;
    const order = await UserService.getOrderById(userId, orderId);
    res.status(200).json(order);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

// Add to wishlist
exports.addToWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;
    const profile = await UserService.addToWishlist(userId, productId);
    res.status(200).json({ message: 'Added to wishlist', profile });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

// Remove from wishlist
exports.removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const productId = req.query.productId;
    const profile = await UserService.removeFromWishlist(userId, productId);
    res.status(200).json({ message: 'Removed from wishlist', profile });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

// Add to cart
exports.addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity } = req.body;
    const profile = await UserService.addToCart(userId, productId, quantity);
    res.status(200).json({ message: 'Added to cart', profile });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

// Remove from cart
exports.removeFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const productId = req.query.productId;
    const profile = await UserService.removeFromCart(userId, productId);
    res.status(200).json({ message: 'Removed from cart', profile });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

// Update profile picture
exports.updateProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;
    const profile = await UserService.updateUserProfilePicture(userId, file);
    res.status(200).json({ message: 'Profile picture updated successfully', profile });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};