const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    required: [true, 'User ID is required'],
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
  },
  password: {
    type: String,
    minlength: [8, 'Password must be at least 8 characters long'],
    validate: {
      validator: function (v) {
        return v ? /^(?=.*[A-Za-z])(?=.*\d).+$/.test(v) : true;
      },
      message: 'Password must contain at least one letter and one number',
    },
  },
  role: {
    type: String,
    enum: ['admin', 'seller', 'vendor', 'customer'],
    default: 'customer',
    required: true,
  },
  profilePicture: {
    public_id: String,
    url: String,
  },
  sellerProfile: {
    storeName: {
      type: String,
      required: function () {
        return this.role === 'seller';
      },
      trim: true,
    },
    storeDescription: {
      type: String,
      trim: true,
    },
  },
  courierProfile: {
    vehicleType: String,
    licensePlate: String,
  },
  addresses: [
    {
      type: {
        type: String,
        enum: ['shipping', 'billing', 'both'],
        required: [true, 'Address type is required'],
      },
      street: {
        type: String,
        required: [true, 'Street is required'],
        trim: true,
      },
      city: {
        type: String,
        required: [true, 'City is required'],
        trim: true,
      },
      state: {
        type: String,
        trim: true,
      },
      zip: {
        type: String,
        trim: true,
      },
      country: {
        type: String,
        required: [true, 'Country is required'],
        trim: true,
      },
      isDefault: {
        type: Boolean,
        default: false,
      },
    },
  ],
  phoneNumber: {
    type: String,
    trim: true,
    match: [/^\+?\d{10,15}$/, 'Please provide a valid phone number'],
  },
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function (v) {
        return v ? v <= new Date() : true;
      },
      message: 'Date of birth cannot be in the future',
    },
  },
  resetPasswordToken: {
    type: String,
    default: null,
  },
  resetPasswordExpiry: {
    type: Date,
    default: null,
    expires: 3600,
  },
  approved: {
    type: Boolean,
    default: false,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  reviews: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review',
    },
  ],
  wishlist: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
  ],
  cart: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Product ID is required'],
      },
      quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [1, 'Quantity cannot be less than 1'],
      },
    },
  ],
}, { timestamps: true });

// Indexes for performance
// userSchema.index({ email: 1 }, { unique: true });
// userSchema.index({ userId: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ approved: 1 });
userSchema.index({ isDeleted: 1 });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    // Validate seller profile if role is seller
    if (this.role === 'seller' && (!this.sellerProfile || !this.sellerProfile.storeName)) {
      return next(new Error('Store name is required for seller role'));
    }
    // Ensure only one default address
    if (this.addresses.some((addr) => addr.isDefault)) {
      this.addresses.forEach((addr, index) => {
        addr.isDefault = this.addresses[index].isDefault ? true : false;
      });
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Virtual field for full profile
userSchema.virtual('fullProfile').get(function () {
  return {
    userId: this.userId,
    name: this.name,
    email: this.email,
    role: this.role,
    approved: this.approved,
    addresses: this.addresses,
    phoneNumber: this.phoneNumber,
    dateOfBirth: this.dateOfBirth,
    profilePicture: this.profilePicture,
    ...(this.sellerProfile && { sellerProfile: this.sellerProfile }),
    ...(this.courierProfile && { courierProfile: this.courierProfile }),
  };
});

module.exports = mongoose.model('User', userSchema);