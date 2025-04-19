const express = require('express');
const router = express.Router();
const { uploadProfilePicture, uploadStoreImage, uploadProductImage } = require('../middleware/upload'); // Import upload middleware
const userController = require('../controllers/user.controller'); // Import user controller
const productController = require('../controllers/product.controller'); // Import product controller

// Upload profile picture
router.post('/upload/profile-picture', uploadProfilePicture, userController.updateUserProfilePicture);

// Upload store image
router.post('/upload/store-image', uploadStoreImage, userController.updateStoreImage);

// Upload product image
router.post('/upload/product-image', uploadProductImage, productController.addProductImage);

module.exports = router;
