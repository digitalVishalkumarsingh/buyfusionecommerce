
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const winston = require('winston');
const User = require('../models/user.model');
const Role = require('../models/role.model');

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/authMiddleware.log' }),
  ],
});

// Validate environment variables
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not defined');
}

/**
 * Middleware to verify JWT token and attach user data to req.user.
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    logger.warn('No token provided', { path: req.path });
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.id || !mongoose.isValidObjectId(decoded.id)) {
      logger.error(`Invalid token payload: ${JSON.stringify(decoded)}`, { token, path: req.path });
      return res.status(403).json({ error: 'Forbidden: Invalid token payload' });
    }
    // Include roleId and permissions if available in token
    req.user = {
      id: decoded.id,
      roleId: decoded.roleId,
      role: decoded.role,
      permissions: decoded.permissions,
    };
    logger.info(`Token verified for user ${decoded.id}`, { path: req.path });
    next();
  } catch (err) {
    logger.error(`Token verification failed: ${err.message}`, { token, path: req.path });
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorized: Token expired' });
    }
    return res.status(403).json({ error: 'Forbidden: Invalid token' });
  }
};

/**
 * Middleware to authorize based on roles.
 * @param {...string} roles - Allowed role names.
 */
const authorizeRoles = (...roles) => {
  return async (req, res, next) => {
    try {
      // Check if role is in JWT (preferred)
      if (req.user.role && roles.includes(req.user.role)) {
        logger.info(`Role ${req.user.role} authorized for user ${req.user.id}`, { path: req.path });
        return next();
      }

      // Fallback: Fetch user and role from database
      if (!mongoose.isValidObjectId(req.user.id)) {
        logger.error(`Invalid user ID in token: ${req.user.id}`, { path: req.path });
        return res.status(400).json({ error: 'Invalid user ID in token' });
      }
      const user = await User.findById(req.user.id).populate('roleId').lean();
      if (!user) {
        logger.warn(`User not found: ${req.user.id}`, { path: req.path });
        return res.status(404).json({ error: 'User not found' });
      }
      if (!user.roleId || !user.roleId.name) {
        logger.error(`User role not defined for user: ${req.user.id}`, { path: req.path });
        return res.status(403).json({ error: 'Forbidden: User role not defined' });
      }
      if (!roles.includes(user.roleId.name)) {
        logger.warn(`Forbidden access for user ${req.user.id} with role ${user.roleId.name}`, {
          path: req.path,
          requiredRoles: roles,
        });
        return res.status(403).json({
          error: `Forbidden: Requires one of the following roles: ${roles.join(', ')}`,
        });
      }
      req.user.role = user.roleId.name;
      req.user.roleId = user.roleId._id; // Ensure roleId is available for authorize middleware
      logger.info(`Role authorized for user ${req.user.id}: ${user.roleId.name}`, { path: req.path });
      next();
    } catch (error) {
      logger.error(`Role authorization error for user ${req.user.id}: ${error.message}`, { path: req.path });
      if (error.name === 'CastError') {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      res.status(500).json({ error: 'Internal server error during role authorization' });
    }
  };
};

// Admin check using authorizeRoles
const verifyAdmin = authorizeRoles('admin');

module.exports = { verifyToken, verifyAdmin, authorizeRoles };
