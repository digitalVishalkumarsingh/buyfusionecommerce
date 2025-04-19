const Coupon = require('../models/coupon.model');

// Apply coupon code
const applyCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body;
    const coupon = await Coupon.findOne({ code: couponCode });

    if (!coupon || coupon.validTill < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired coupon' });
    }

    res.status(200).json({ message: 'Coupon applied successfully', discount: coupon.discountPercentage });
  } catch (err) {
    res.status(500).json({ message: 'Error applying coupon' });
  }
};

module.exports = { applyCoupon };
