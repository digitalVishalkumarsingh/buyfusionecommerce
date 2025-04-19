
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const winston = require('winston');

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/upload.log' }),
  ],
});

// Validate Cloudinary configuration
const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};
if (!cloudinaryConfig.cloud_name || !cloudinaryConfig.api_key || !cloudinaryConfig.api_secret) {
  logger.error('Missing Cloudinary configuration in .env. File uploads will fail.');
  // Allow server to start; handle failures in middleware
} else {
  cloudinary.config(cloudinaryConfig);
  logger.info('Cloudinary configured successfully');
}

// File size limits
const FILE_SIZE_LIMITS = {
  profilePicture: 2 * 1024 * 1024, // 2MB
  storeImage: 5 * 1024 * 1024, // 5MB
  productImage: 10 * 1024 * 1024, // 10MB
};

// Configure storage for different image types
const storage = {
  profilePictureStorage: new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'ecommerce/profile_pictures',
      allowed_formats: ['jpg', 'jpeg', 'png'],
      transformation: [{ width: 300, height: 300, crop: 'fill', gravity: 'auto' }],
      public_id: (req, file) => `profile_${req.user?.id}_${Date.now()}`,
    },
  }),
  storeImageStorage: new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'ecommerce/store_images',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      public_id: (req, file) => `store_${req.user?.id}_${Date.now()}`,
    },
  }),
  productImageStorage: new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'ecommerce/products',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      public_id: (req, file) => `product_${req.user?.id}_${Date.now()}`,
    },
  }),
};

/**
 * Creates Multer middleware for file uploads with Cloudinary.
 * @param {CloudinaryStorage} storageType - Cloudinary storage instance.
 * @param {string} fieldName - Form field name for the file(s).
 * @param {number} maxCount - Maximum number of files (1 for single, >1 for array).
 * @param {number} maxSize - Maximum file size in bytes.
 * @returns {Function} Multer middleware.
 */
const handleFileUpload = (storageType, fieldName, maxCount, maxSize) => {
  const multerOptions = {
    storage: storageType,
    limits: { fileSize: maxSize },
    fileFilter(req, file, cb) {
      if (!cloudinaryConfig.cloud_name || !cloudinaryConfig.api_key || !cloudinaryConfig.api_secret) {
        const error = new Error('Cloudinary configuration missing. File uploads are disabled.');
        logger.error(error.message, { fieldName, userId: req.user?.id });
        return cb(error);
      }
      const allowedMimes = storageType === storage.profilePictureStorage
        ? ['image/jpeg', 'image/png']
        : ['image/jpeg', 'image/png', 'image/webp'];
      const allowedExts = storageType === storage.profilePictureStorage
        ? /\.(jpg|jpeg|png)$/
        : /\.(jpg|jpeg|png|webp)$/;
      if (!allowedMimes.includes(file.mimetype) || !file.originalname.match(allowedExts)) {
        const error = new multer.MulterError(
          'LIMIT_FORMAT',
          `Invalid file type. Allowed: ${allowedMimes.join(', ')}`
        );
        logger.error(`File upload rejected: Invalid type ${file.mimetype}`, {
          fieldName,
          userId: req.user?.id,
          filename: file.originalname,
        });
        return cb(error);
      }
      cb(null, true);
    },
  };

  return maxCount === 1
    ? multer(multerOptions).single(fieldName)
    : multer(multerOptions).array(fieldName, maxCount);
};

/**
 * Cleans up a failed upload from Cloudinary.
 * @param {string} publicId - Cloudinary public ID of the file.
 */
const cleanupFailedUpload = async (publicId) => {
  if (!publicId || !cloudinaryConfig.cloud_name) return;
  try {
    await cloudinary.uploader.destroy(publicId);
    logger.info(`Cleaned up failed upload: ${publicId}`);
  } catch (error) {
    logger.error(`Failed to clean up upload: ${error.message}`, { publicId });
  }
};

// Export upload functions
exports.uploadProductImage = handleFileUpload(
  storage.productImageStorage,
  'productImages',
  5,
  FILE_SIZE_LIMITS.productImage
);
exports.uploadStoreImage = handleFileUpload(
  storage.storeImageStorage,
  'storeImages',
  5,
  FILE_SIZE_LIMITS.storeImage
);
exports.uploadProfilePicture = handleFileUpload(
  storage.profilePictureStorage,
  'profile',
  1,
  FILE_SIZE_LIMITS.profilePicture
);
exports.cleanupFailedUpload = cleanupFailedUpload;
