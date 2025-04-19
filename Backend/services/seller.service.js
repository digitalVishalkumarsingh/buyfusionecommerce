const Seller = require('../models/seller.model');
const Product = require('../models/product.model');
const Order = require('../models/order.model');
const User = require('../models/user.model'); // Import User model
const { uploadProductImage } = require('../middlewares/fileUpload'); // Import upload middleware

// Get seller profile
exports.getSellerProfile = async (sellerId) => {
    try {
        // Fetch the user and populate the seller profile
        const seller = await User.findById(sellerId).populate({
            path: 'sellerProfile',
            populate: {
                path: 'storeCategory', // If storeCategory is a reference
                model: 'Category' // Replace 'Category' with your actual category model name
            }
        });
        if (!seller) throw new Error('Seller not found');
        return seller;
    } catch (error) {
        console.error('Error fetching seller profile:', error);
        throw new Error(error.message);
    }
};

// Update seller profile
exports.updateSellerProfile = async (sellerId, profileData) => {
    try {
        // First, find the user
        const user = await User.findById(sellerId);
        if (!user) {
            throw new Error('Seller not found');
        }

        // Then, update the seller profile
        Object.assign(user.sellerProfile, profileData);
        await user.save();

        return user;
    } catch (error) {
        console.error('Error updating seller profile:', error);
        throw new Error(error.message);
    }
};

// Add a product
exports.addProduct = async (req, productData, sellerId) => {
    try {
        // Extract image URLs from request
        const images = req.files.map(file => ({ url: file.path, public_id: file.filename }));

        // Ensure images are passed in productData
        const newProduct = new Product({
            ...productData,
            seller: sellerId,
            images: images // Add images to product
        });
        await newProduct.save();

        // Optionally, update the seller's product list
        const seller = await User.findById(sellerId);
        if (seller) {
            seller.products = seller.products || [];
            seller.products.push(newProduct._id);
            await seller.save();
        }

        return newProduct;
    } catch (error) {
        console.error('Error adding product:', error);
        throw new Error(error.message);
    }
};

// Update a product
exports.updateProduct = async (sellerId, productId, productData) => {
    try {
        const product = await Product.findOne({ _id: productId, seller: sellerId });
        if (!product) throw new Error('Product not found');

        // Update the product
        Object.assign(product, productData);
        await product.save();

        return product;
    } catch (error) {
        console.error('Error updating product:', error);
        throw new Error(error.message);
    }
};

// Get products for the seller
exports.getSellerProducts = async (sellerId) => {
    try {
        const products = await Product.find({ seller: sellerId });
        return products;
    } catch (error) {
        console.error('Error fetching seller products:', error);
        throw new Error(error.message);
    }
};

// Get orders for the seller
exports.getSellerOrders = async (sellerId) => {
    try {
        const orders = await Order.find({ 'products.sellerId': sellerId })
            .populate('userId', 'name email')
            .populate({
                path: 'products.productId', // Populate product details
                model: 'Product' // Ensure this matches your product model name
            });
        return orders;
    } catch (error) {
        console.error('Error fetching seller orders:', error);
        throw new Error(error.message);
    }
};

// Update order status
exports.updateOrderStatus = async (orderId, status, sellerId) => {
    try {
        const order = await Order.findOne({ _id: orderId, 'products.sellerId': sellerId });
        if (!order) throw new Error('Order not found');

        // Update the order status
        order.status = status;
        await order.save();

        return order;
    } catch (error) {
        console.error('Error updating order status:', error);
        throw new Error(error.message);
    }
};
