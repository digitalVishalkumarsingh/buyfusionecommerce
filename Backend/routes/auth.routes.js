const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken, verifyAdmin, authorizeRoles } = require('../middlewares/verifyToken');

// Logging middleware
const logRouteHit = (req, res, next) => {
  console.log(`Route hit: ${req.method} ${req.path}`);
  next();
};

// Customer Registration
router.post('/register',  authController.registerCustomer);

// Seller/Vendor Registration
router.post('/register/seller',  authController.registerSellerOrVendor);

// Customer Login
router.post('/login', authController.loginCustomer);

// Seller/Vendor Login
router.post('/login/seller', authController.loginSellerOrVendor);

// Admin Login
router.post('/login/admin',  authController.loginAdmin);

// Logout
router.post('/logout', logRouteHit, authController.logout);

// Password Reset
router.post('/password/request-reset', logRouteHit, authController.requestPasswordReset);
router.post('/password/reset/:token', logRouteHit, authController.resetPassword);

// Change Password (protected route)
router.post('/password/change', logRouteHit, verifyToken, authController.changePassword);

// Promote user to seller/vendor (admin only)
router.post('/promote', logRouteHit, verifyToken, verifyAdmin, authController.promoteToSellerOrVendor);

// Refresh Token
router.post('/token/refresh', logRouteHit, authController.refreshToken);

// Set First Admin (used once, optional protection)
router.post('/admin/setup', logRouteHit, authController.setFirstAdminAccount);

// Google SSO (for both registration and login)
router.post('/google', logRouteHit, authController.registerOrLoginWithGoogle); // Register or login via Google SSO

// Google OAuth routes
router.get('/google/login', logRouteHit, authController.googleLogin);  // Redirect to Google OAuth
router.get('/google/callback', logRouteHit, authController.googleCallback);  // Google OAuth callback

module.exports = router;