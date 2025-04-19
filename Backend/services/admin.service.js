const User = require('../models/user.model');
const Product = require('../models/product.model');
const Order = require('../models/order.model');

// Custom error class for better error handling
class ServiceError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ServiceError';
  }
}

const adminService = {
  // Get all users
  getAllUsers: async () => {
    try {
      const users = await User.find({ role: 'user' })
        .select('-password -__v') // Exclude password and version key
        .lean(); // Return plain JavaScript object for performance
      if (!users || users.length === 0) {
        throw new ServiceError('No users found', 404);
      }
      return users;
    } catch (error) {
      throw error instanceof ServiceError ? error : new ServiceError('Failed to get all users: ' + error.message);
    }
  },

  // Get all sellers
  getAllSellers: async () => {
    try {
      const sellers = await User.find({ role: 'seller' })
        .select('-password -__v')
        .lean();
      if (!sellers || sellers.length === 0) {
        throw new ServiceError('No sellers found', 404);
      }
      return sellers;
    } catch (error) {
      throw error instanceof ServiceError ? error : new ServiceError('Failed to get all sellers: ' + error.message);
    }
  },

  // Get seller by ID
  getSellerById: async (sellerId) => {
    try {
      if (!sellerId || isNaN(sellerId)) {
        throw new ServiceError('Invalid seller ID', 400);
      }
      const seller = await User.findById(sellerId)
        .select('-password -__v')
        .lean();
      if (!seller) {
        throw new ServiceError('Seller not found', 404);
      }
      return seller;
    } catch (error) {
      throw error instanceof ServiceError ? error : new ServiceError('Failed to get seller by ID: ' + error.message);
    }
  },

  // Get seller products
  getSellerProducts: async (sellerId) => {
    try {
      if (!sellerId || isNaN(sellerId)) {
        throw new ServiceError('Invalid seller ID', 400);
      }
      const products = await Product.find({ sellerId })
        .select('-__v') // Exclude version key
        .lean();
      if (!products || products.length === 0) {
        throw new ServiceError('No products found for this seller', 404);
      }
      return products;
    } catch (error) {
      throw error instanceof ServiceError ? error : new ServiceError('Failed to get seller products: ' + error.message);
    }
  },

  // Get seller orders
  getSellerOrders: async (sellerId) => {
    try {
      if (!sellerId || isNaN(sellerId)) {
        throw new ServiceError('Invalid seller ID', 400);
      }
      const orders = await Order.find({ 'products.sellerId': sellerId })
        .populate('userId', 'name email -_id') // Exclude _id from user
        .populate('products.productId', 'name price -_id') // Exclude _id from product
        .select('-__v')
        .lean();
      if (!orders || orders.length === 0) {
        throw new ServiceError('No orders found for this seller', 404);
      }
      return orders;
    } catch (error) {
      throw error instanceof ServiceError ? error : new ServiceError('Failed to get seller orders: ' + error.message);
    }
  },

  // Remove seller
  removeSeller: async (sellerId) => {
    try {
      if (!sellerId || isNaN(sellerId)) {
        throw new ServiceError('Invalid seller ID', 400);
      }
      const seller = await User.findByIdAndDelete(sellerId);
      if (!seller) {
        throw new ServiceError('Seller not found', 404);
      }
      // Optionally remove associated products and orders
      await Product.deleteMany({ sellerId });
      await Order.deleteMany({ 'products.sellerId': sellerId });
      return { message: 'Seller and associated data removed successfully' };
    } catch (error) {
      throw error instanceof ServiceError ? error : new ServiceError('Failed to remove seller: ' + error.message);
    }
  },

  // Update seller status (active/inactive)
  updateSellerStatus: async (sellerId, isActive) => {
    try {
      if (!sellerId || isNaN(sellerId)) {
        throw new ServiceError('Invalid seller ID', 400);
      }
      if (typeof isActive !== 'boolean') {
        throw new ServiceError('isActive must be a boolean', 400);
      }
      const seller = await User.findByIdAndUpdate(
        sellerId,
        { isActive },
        { new: true, runValidators: true }
      ).select('-password -__v').lean();
      if (!seller) {
        throw new ServiceError('Seller not found', 404);
      }
      return seller;
    } catch (error) {
      throw error instanceof ServiceError ? error : new ServiceError('Failed to update seller status: ' + error.message);
    }
  },

  // Get system reports (example: total users, total products, total orders)
  getSystemReports: async () => {
    try {
      const [totalUsers, totalSellers, totalProducts, totalOrders] = await Promise.all([
        User.countDocuments({ role: 'user' }),
        User.countDocuments({ role: 'seller' }),
        Product.countDocuments(),
        Order.countDocuments(),
      ]);
      if (totalUsers === 0 && totalSellers === 0 && totalProducts === 0 && totalOrders === 0) {
        throw new ServiceError('No data available for reports', 404);
      }
      return {
        totalUsers,
        totalSellers,
        totalProducts,
        totalOrders,
        timestamp: new Date(),
      };
    } catch (error) {
      throw error instanceof ServiceError ? error : new ServiceError('Failed to get system reports: ' + error.message);
    }
  },

  // Promote user to seller or vendor
  promoteToSellerOrVendor: async (userId, newRole, storeName, storeDescription) => {
    try {
      if (!userId || isNaN(userId)) {
        throw new ServiceError('Invalid user ID', 400);
      }
      if (!['seller', 'vendor'].includes(newRole)) {
        throw new ServiceError('Role must be "seller" or "vendor"', 400);
      }
      if (newRole === 'seller' && (!storeName || !storeDescription)) {
        throw new ServiceError('Store name and description are required for seller role', 400);
      }

      const user = await User.findByIdAndUpdate(
        userId,
        {
          role: newRole,
          ...(newRole === 'seller' && { sellerProfile: { storeName, storeDescription } }),
          isActive: true, // Default to active on promotion
        },
        { new: true, runValidators: true }
      ).select('-password -__v').lean();

      if (!user) {
        throw new ServiceError('User not found', 404);
      }
      return { userId: user._id, role: user.role };
    } catch (error) {
      throw error instanceof ServiceError ? error : new ServiceError('Failed to promote user: ' + error.message);
    }
  },
};

module.exports = adminService;