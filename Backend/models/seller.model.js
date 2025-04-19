const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
        match: [/^\+?([0-9]{10,12})$/, 'Please provide a valid phone number'],
        trim: true
    },
    storeName: {
        type: String,
        required: [true, 'Store name is required'],
        trim: true
    },
    storeDescription: {
        type: String,
        required: [true, 'Store description is required'],
        trim: true
    },
    storeCategory: {
        type: String,
        enum: ['electronics', 'clothing', 'furniture', 'toys', 'sports', 'others'],
        default: 'others'
    },
    storeLogo: {
        public_id: String,
        url: String
    },
    storeBanner: {
        public_id: String,
        url: String
    },
    address: {
        street: String,
        city: String,
        state: String,
        zip: String,
        country: String
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: {
        type: String,
        default: null
    },
    verificationExpiry: {
        type: Date,
        default: null,
        expires: 86400 // Auto-delete after 24 hours
    },
    rating: {
        type: Number,
        default: 0,
        min: [0, 'Rating cannot be negative'],
        max: [5, 'Rating cannot exceed 5']
    },
    reviews: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Review'
    }],
    isDeleted: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Indexes for performance
sellerSchema.index({ email: 1 }, { unique: true });
sellerSchema.index({ isVerified: 1 });
sellerSchema.index({ storeCategory: 1 });
sellerSchema.index({ rating: -1 });

// Pre-save hook for validation
sellerSchema.pre('save', function(next) {
    if (this.address && (!this.address.street || !this.address.city || !this.address.country)) {
        return next(new Error('All address fields are required if any are provided'));
    }
    next();
});

// Optional: Method to update rating based on reviews
sellerSchema.methods.updateRating = async function() {
    const Review = mongoose.model('Review');
    const reviews = await Review.find({ _id: { $in: this.reviews } });
    const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
    this.rating = reviews.length ? totalRating / reviews.length : 0;
    return this.save();
};

module.exports = mongoose.model('Seller', sellerSchema);