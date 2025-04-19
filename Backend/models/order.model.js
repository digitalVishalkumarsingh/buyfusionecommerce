const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  products: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Product ID is required']
      },
      quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [1, 'Quantity cannot be less than 1']
      },
      price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative']
      },
      sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Seller ID is required']
      }
    }
  ],
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    zip: String,
    country: String
  },
  billingAddress: {
    street: String,
    city: String,
    state: String,
    zip: String,
    country: String
  },
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'paypal', 'stripe', 'cod'],
    default: 'razorpay',
    required: [true, 'Payment method is required']
  },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
    required: [true, 'Payment status is required']
  },
  status: {
    type: String,
    enum: ['pending', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
    required: [true, 'Order status is required']
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Indexes for performance
orderSchema.index({ userId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ isDeleted: 1 });

// Pre-save hooks
orderSchema.pre('save', function(next) {
    // Calculate total amount
    this.totalAmount = this.products.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Validate addresses
    const hasShipping = Object.keys(this.shippingAddress).length > 0;
    const hasBilling = Object.keys(this.billingAddress).length > 0;
    if (hasShipping && (!this.shippingAddress.street || !this.shippingAddress.city || !this.shippingAddress.country)) {
        return next(new Error('All shipping address fields are required if any are provided'));
    }
    if (hasBilling && (!this.billingAddress.street || !this.billingAddress.city || !this.billingAddress.country)) {
        return next(new Error('All billing address fields are required if any are provided'));
    }
    next();
});

// Optional: Method to update order status
orderSchema.methods.updateStatus = function(newStatus) {
    if (!['pending', 'shipped', 'delivered', 'cancelled'].includes(newStatus)) {
        throw new Error('Invalid order status');
    }
    this.status = newStatus;
    return this.save();
};

module.exports = mongoose.model('Order', orderSchema);