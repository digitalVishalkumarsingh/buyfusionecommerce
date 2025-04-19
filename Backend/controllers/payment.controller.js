const paymentService = require('../services/payment.service');
const Order = require('../models/order.model'); // Ensure correct path to your Order model
const sendEmail = require('../services/emailService'); // Import the email service
const User = require('../models/user.model'); // Import the User model

// Create Order API
const createOrder = async (req, res) => {
  const { userId, products, totalAmount } = req.body;

  try {
    // Creating the order in Razorpay
    const razorpayOrder = await paymentService.createOrder(userId, products, totalAmount);
    
    // Save the order details in the database
    const order = new Order({
      userId,
      products,
      totalAmount,
      razorpayOrderId: razorpayOrder.id,
      status: 'pending', // Initially set status to 'pending' before payment is verified
    });
    await order.save();

    // Respond with the order id and currency
    return res.status(200).json({ orderId: razorpayOrder.id, currency: 'INR' });
  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(500).json({ message: 'Error creating order', error: error.message });
  }
};

// Payment Verification API
const verifyPayment = async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  try {
    // Verify the payment signature using the service
    const isVerified = await paymentService.verifyPayment(req.body, razorpayOrderId, razorpayPaymentId, razorpaySignature);

    if (isVerified) {
      // If payment is verified, update payment status and order status
      await paymentService.updatePaymentStatus(razorpayOrderId, 'completed');
      const updatedOrder = await Order.findOneAndUpdate(
        { razorpayOrderId },
        { status: 'shipped' }, // Assuming 'shipped' is the next status
        { new: true }
      );
      if (!updatedOrder) {
        return res.status(404).json({ message: 'Order not found for updating status.' });
      }

      // Send confirmation email
      const user = await User.findById(updatedOrder.userId); // Get user details to send email
      if (user && user.email) {
        const emailHtml = `
          <html>
            <body>
              <h1>Payment Confirmation</h1>
              <p>Your payment for order ${updatedOrder.razorpayOrderId} has been successfully processed.</p>
              <p>Total Amount: ₹${updatedOrder.totalAmount}</p>
              <p>Your order will be shipped soon.</p>
            </body>
          </html>
        `;
        try {
          await sendEmail(user.email, 'Payment Confirmation', emailHtml);
          console.log('Payment confirmation email sent successfully.');
        } catch (emailError) {
          console.error('Error sending email:', emailError);
          // Consider logging the email error, but don't block the payment process
        }
      }

      return res.status(200).json({ message: 'Payment successful' });
    } else {
      // If payment verification fails, update order and payment status
      await paymentService.updatePaymentStatus(razorpayOrderId, 'failed');
      const updatedOrder = await Order.findOneAndUpdate(
        { razorpayOrderId },
        { status: 'failed' }, // Assuming 'failed' status
        { new: true }
      );
      if (!updatedOrder) {
        return res.status(404).json({ message: 'Order not found for updating status.' });
      }

      return res.status(400).json({ message: 'Payment verification failed' });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({ message: 'Error verifying payment', error: error.message });
  }
};

// Get Order Details API
const getOrderDetails = async (req, res) => {
  const { orderId } = req.params;

  try {
    // Find the order by razorpayOrderId
    const order = await Order.findOne({ razorpayOrderId: orderId }).populate('userId products.productId products.sellerId');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Return the order details as a response
    return res.status(200).json(order);
  } catch (error) {
    console.error('Error getting order details:', error);
    return res.status(500).json({ message: 'Error getting order details', error: error.message });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getOrderDetails,
};
