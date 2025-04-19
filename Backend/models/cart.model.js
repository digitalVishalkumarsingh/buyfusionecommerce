const mongoose = require('mongoose');

const CartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  items: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Product ID is required'],
      },
      name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
      },
      price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative'],
      },
      quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [1, 'Quantity must be at least 1'],
      },
      totalPrice: {
        type: Number,
        required: [true, 'Total price is required'],
        min: [0, 'Total price cannot be negative'],
      },
    },
    {
      validate: {
        validator: function (v) {
          const productIds = v.map((item) => item.productId.toString());
          return new Set(productIds).size === productIds.length;
        },
        message: 'Duplicate products are not allowed in cart',
      },
    },
  ],
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative'],
    default: 0,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Indexes for performance
CartSchema.index({ userId: 1 });
CartSchema.index({ 'items.productId': 1 });

// Pre-save hook to validate and calculate totals
CartSchema.pre('save', async function (next) {
  try {
    // Validate product existence, stock, and price
    const productIds = this.items.map((item) => item.productId);
    const products = await mongoose.model('Product').find({
      _id: { $in: productIds },
      isActive: true,
      isDeleted: false,
    }).lean();

    if (products.length !== productIds.length) {
      return next(new Error('One or more products are unavailable'));
    }

    for (const item of this.items) {
      const product = products.find((p) => p._id.toString() === item.productId.toString());
      if (!product) {
        return next(new Error(`Product ${item.productId} not found`));
      }
      if (product.stock < item.quantity) {
        return next(new Error(`Insufficient stock for product ${product.name}`));
      }
      // Update item price to match product price
      item.price = product.price;
      item.totalPrice = item.price * item.quantity;
    }

    // Calculate total amount
    this.totalAmount = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to add or update item
CartSchema.methods.addItem = async function (productId, name, price, quantity, session = null) {
  const product = await mongoose.model('Product').findOne({
    _id: productId,
    isActive: true,
    isDeleted: false,
  }).lean();
  if (!product) {
    throw new Error('Product not found or unavailable');
  }
  if (product.stock < quantity) {
    throw new Error(`Insufficient stock for product ${product.name}`);
  }

  const existingItemIndex = this.items.findIndex(
    (item) => item.productId.toString() === productId.toString()
  );
  if (existingItemIndex > -1) {
    this.items[existingItemIndex].quantity += quantity;
    this.items[existingItemIndex].price = product.price;
    this.items[existingItemIndex].totalPrice =
      this.items[existingItemIndex].price * this.items[existingItemIndex].quantity;
  } else {
    this.items.push({
      productId,
      name: product.name,
      price: product.price,
      quantity,
      totalPrice: product.price * quantity,
    });
  }
  this.totalAmount = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  return await this.save({ session }); // Pass session for transactional consistency
};

module.exports = mongoose.model('Cart', CartSchema);