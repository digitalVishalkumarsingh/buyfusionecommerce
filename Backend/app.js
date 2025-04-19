const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

// Import routes
const authRoutes = require('./routes/auth.routes');
 const cartRoutes = require('./routes/cart.routes');
 const orderRoutes = require('./routes/order.routes');
  const productRoutes = require('./routes/product.routes');
  const userRoutes = require('./routes/user.routes');
  const adminRoutes = require('./routes/admin.routes');
  const sellerRoutes = require('./routes/seller.routes');
const paymentRoutes = require('./routes/payments.routes'); // Added payment routes

// Import the database connection configuration
const dbConnection = require('./config/db.config');

// Load environment variables from .env file
dotenv.config();

const app = express();

// Middleware setup
app.use(helmet());
app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));

// Rate Limiting Middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
});
app.use(limiter);

app.use(morgan('combined'));


// Connect to the database
dbConnection();

// Routes setup
app.use('/api/auth', authRoutes);
app.use('/api/cart', cartRoutes);
 app.use('/api/orders', orderRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/admin', adminRoutes);
 app.use('/api/seller', sellerRoutes);
 app.use('/api/payment', paymentRoutes); // Added payment routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware for 404 routes
app.use((req, res, next) => {
  res.status(404).json({ message: 'Route not found' });
});

// General error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ message: 'Internal Server Error' });
});


// Start the server
const PORT = process.env.PORT || 5100;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
