const SellerService = require('../services/seller.service');
const Product = require('../models/product.model');
const Order = require('../models/order.model');

// Get seller profile
exports.getSellerProfile = async (req, res) => {
    try {
        const seller = await SellerService.getSellerProfile(req.user.id); // Use req.user.id as sellerId
        if (!seller) return res.status(404).json({ message: "Seller not found" });
        res.status(200).json(seller);
    } catch (error) {
        console.error("Error fetching seller profile:", error);
        res.status(500).json({ message: "Error fetching seller profile", error: error.message });
    }
};

// Update seller profile
exports.updateSellerProfile = async (req, res) => {
    try {
        const updatedSeller = await SellerService.updateSellerProfile(req.user.id, req.body); // Use req.user.id
        if (!updatedSeller) return res.status(404).json({ message: "Seller profile not found" });
        res.status(200).json(updatedSeller);
    } catch (error) {
        console.error("Error updating seller profile:", error);
        res.status(400).json({ message: "Error updating profile", error: error.message });
    }
};

// Product Management - Add Product
exports.addProduct = async (req, res) => {
    try {
        const { name, price, stock } = req.body;
        if (!name || !price || !stock) {
            return res.status(400).json({ message: 'Name, price, and stock are required' });
        }

        // Ensure user has permission to add product
        if (req.user.roleId.permissions && !req.user.roleId.permissions.includes('products:create')) {
            return res.status(403).json({ message: 'Unauthorized to add products' });
        }

        const newProduct = await SellerService.addProduct(req.body, req.user.id); // req.user.id as sellerId
        res.status(201).json(newProduct);
    } catch (error) {
        console.error("Error adding product:", error);
        res.status(400).json({ message: "Error adding product", error: error.message });
    }
};

// Product Management - Update Product
exports.updateProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        // Ensure user has permission to update product
        if (req.user.roleId.permissions && !req.user.roleId.permissions.includes('products:update')) {
            return res.status(403).json({ message: 'Unauthorized to update products' });
        }

        const updatedProduct = await SellerService.updateProduct(req.user.id, productId, req.body); // Use sellerId
        if (!updatedProduct) return res.status(404).json({ message: "Product not found" });
        res.status(200).json(updatedProduct);
    } catch (error) {
        console.error("Error updating product:", error);
        res.status(400).json({ message: "Error updating product", error: error.message });
    }
};

// Product Management - Get Products of the Seller
exports.getSellerProducts = async (req, res) => {
    try {
        // Ensure user has permission to view products
        if (req.user.roleId.permissions && !req.user.roleId.permissions.includes('products:read')) {
            return res.status(403).json({ message: 'Unauthorized to view products' });
        }

        const products = await SellerService.getSellerProducts(req.user.id); // Use sellerId
        if (!products || products.length === 0) return res.status(404).json({ message: "No products found for this seller" });
        res.status(200).json(products);
    } catch (error) {
        console.error("Error retrieving products:", error);
        res.status(500).json({ message: "Error retrieving products", error: error.message });
    }
};

// Order Management - Get Orders for the Seller
exports.getSellerOrders = async (req, res) => {
    try {
        // Ensure user has permission to view orders
        if (req.user.roleId.permissions && !req.user.roleId.permissions.includes('orders:read')) {
            return res.status(403).json({ message: 'Unauthorized to view orders' });
        }

        const orders = await SellerService.getSellerOrders(req.user.id); // Use sellerId
        if (!orders || orders.length === 0) return res.status(404).json({ message: "No orders found for this seller" });
        res.status(200).json(orders);
    } catch (error) {
        console.error("Error retrieving orders:", error);
        res.status(500).json({ message: "Error retrieving orders", error: error.message });
    }
};

// Order Management - Update Order Status
exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        // Ensure user has permission to update order status
        if (req.user.roleId.permissions && !req.user.roleId.permissions.includes('orders:update')) {
            return res.status(403).json({ message: 'Unauthorized to update order status' });
        }

        const updatedOrder = await SellerService.updateOrderStatus(orderId, status, req.user.id); // Use sellerId
        if (!updatedOrder) return res.status(404).json({ message: "Order not found" });
        res.status(200).json(updatedOrder);
    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(400).json({ message: "Error updating order status", error: error.message });
    }
};
