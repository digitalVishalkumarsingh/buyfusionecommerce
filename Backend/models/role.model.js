const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    enum: ['admin', 'seller', 'vendor', 'customer'],
    required: [true, 'Role name is required'],
    trim: true
  },
  permissions: {
    type: Map,
    of: [String],
    default: undefined,
    validate: {
      validator: function(v) {
          if (!v || v.size === 0) return true;
          const perms = new Set(v.get('permissions') || []);
          return perms.size === (v.get('permissions') || []).length; // No duplicates
      },
      message: 'Permissions cannot contain duplicates'
    }
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Unique index on name
roleSchema.index({ name: 1 }, { unique: true });

// Dynamically set default permissions based on role name
roleSchema.pre('save', function(next) {
  if (!this.permissions || this.permissions.size === 0) {
    const defaultPermissions = {
      admin: ['*'], // Full access to all resources
      seller: ['products:create', 'products:read', 'products:update', 'products:delete', 'orders:read'],
      vendor: ['deliveries:update', 'deliveries:read'],
      customer: ['orders:create', 'orders:read', 'profile:update']
    };

    if (this.name in defaultPermissions) {
      this.permissions = new Map();
      this.permissions.set('permissions', defaultPermissions[this.name]);
    }
  }
  next();
});

// Optional: Method to add or update permissions
roleSchema.methods.updatePermissions = function(permissionList) {
  if (!Array.isArray(permissionList)) {
    throw new Error('Permissions must be an array');
  }
  const perms = new Set(permissionList);
  this.permissions.set('permissions', Array.from(perms));
  return this.save();
};

module.exports = mongoose.model('Role', roleSchema);