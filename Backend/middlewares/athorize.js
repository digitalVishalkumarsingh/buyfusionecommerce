
const mongoose = require('mongoose');
const winston = require('winston');
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

/**
 * Middleware to authorize requests based on required permissions.
 * @param {string|string[]} requiredPermissions - Single permission or array of permissions.
 * @param {Object} [options] - Configuration options.
 * @param {boolean} [options.requireAll=true] - If true, requires all permissions; if false, requires at least one.
 * @returns {Function} Express middleware.
 */
const authorize = (requiredPermissions, { requireAll = true } = {}) => {
  // Normalize to array for consistency
  const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

  return async (req, res, next) => {
    try {
      // Validate req.user and req.user.id
      if (!req.user || !mongoose.isValidObjectId(req.user.id)) {
        logger.warn('Invalid or missing user in token', { path: req.path, user: req.user });
        return res.status(401).json({ error: 'Unauthorized: Invalid user information' });
      }

      // Check if permissions are included in JWT (optimization)
      if (req.user.permissions) {
        if (req.user.permissions.includes('*')) {
          logger.info(`Wildcard permission granted for user ${req.user.id}`, { path: req.path });
          return next();
        }
        const hasAccess = requireAll
          ? permissions.every((perm) => req.user.permissions.includes(perm))
          : permissions.some((perm) => req.user.permissions.includes(perm));
        if (!hasAccess) {
          logger.warn(`Insufficient permissions for user ${req.user.id}`, {
            path: req.path,
            required: permissions,
            actual: req.user.permissions,
          });
          return res.status(403).json({
            error: `Forbidden: Insufficient permissions. Required: ${permissions.join(', ')}`,
          });
        }
        logger.info(`Permissions granted for user ${req.user.id}`, { path: req.path, permissions });
        return next();
      }

      // Fallback: Fetch role from database
      if (!mongoose.isValidObjectId(req.user.roleId)) {
        logger.warn(`Invalid roleId for user ${req.user.id}`, { path: req.path, roleId: req.user.roleId });
        return res.status(403).json({ error: 'Forbidden: Invalid user role' });
      }

      const role = await Role.findById(req.user.roleId).select('permissions').lean();
      if (!role || !role.permissions) {
        logger.warn(`Role not found or no permissions for user ${req.user.id}`, { path: req.path, roleId: req.user.roleId });
        return res.status(403).json({ error: 'Forbidden: User role not found or invalid' });
      }

      if (role.permissions.includes('*')) {
        logger.info(`Wildcard permission granted for user ${req.user.id}`, { path: req.path });
        return next();
      }

      const hasAccess = requireAll
        ? permissions.every((perm) => role.permissions.includes(perm))
        : permissions.some((perm) => role.permissions.includes(perm));
      if (!hasAccess) {
        logger.warn(`Insufficient permissions for user ${req.user.id}`, {
          path: req.path,
          required: permissions,
          actual: role.permissions,
        });
        return res.status(403).json({
          error: `Forbidden: Insufficient permissions. Required: ${permissions.join(', ')}`,
        });
      }

      logger.info(`Permissions granted for user ${req.user.id}`, { path: req.path, permissions });
      next();
    } catch (error) {
      logger.error(`Authorization error for user ${req.user?.id}: ${error.message}`, { path: req.path });
      if (error.name === 'CastError') {
        return res.status(400).json({ error: 'Invalid role ID' });
      }
      res.status(500).json({ error: 'Internal server error during authorization' });
    }
  };
};

module.exports = authorize;
