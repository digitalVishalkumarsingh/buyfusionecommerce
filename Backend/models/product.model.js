const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative']
    },
    discountPrice: {
        type: Number,
        default: null,
        min: [0, 'Discount price cannot be negative']
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: [true, 'Category is required']
    },
    subcategories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subcategory'
    }],
    description: {
        type: String,
        trim: true
    },
    stock: {
        type: Number,
        required: [true, 'Stock is required'],
        min: [0, 'Stock cannot be negative']
    },
    images: [{
        public_id: String,
        url: String
    }],
    rating: {
        type: Number,
        min: [0, 'Rating cannot be less than 0'],
        max: [5, 'Rating cannot exceed 5'],
        default: 0
    },
    reviews: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User is required for review']
        },
        rating: {
            type: Number,
            min: [0, 'Rating cannot be less than 0'],
            max: [5, 'Rating cannot exceed 5'],
            required: [true, 'Rating is required']
        },
        comment: {
            type: String,
            trim: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Seller is required']
    },
    size: {
        type: String,
        trim: true
    },
    brand: {
        type: String,
        trim: true
    },
    color: {
        type: String,
        trim: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Indexes for performance
productSchema.index({ seller: 1 });
productSchema.index({ category: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ isDeleted: 1 });

// Pre-save hook for discount price validation
productSchema.pre('save', function(next) {
    if (this.discountPrice && this.discountPrice >= this.price) {
        return next(new Error('Discount price must be less than regular price'));
    }
    next();
});

// Optional: Method to update product rating based on reviews
productSchema.methods.updateRating = async function() {
    const totalRating = this.reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
    this.rating = this.reviews.length ? totalRating / this.reviews.length : 0;
    return this.save();
};

module.exports = mongoose.model('Product', productSchema);