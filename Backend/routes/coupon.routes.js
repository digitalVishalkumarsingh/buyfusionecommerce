const express = require('express');
const { verifyToken } = require('../middlewares/verifyToken');
const { applyCoupon } = require('../controllers/coupon.controller');

const router = express.Router();

// User Route: Apply coupon
router.post('/apply', verifyToken, applyCoupon);

module.exports = router;
