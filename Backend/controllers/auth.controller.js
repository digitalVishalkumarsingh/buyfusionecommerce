require('dotenv').config();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const User = require('../models/user.model');
const Seller = require('../models/seller.model');
const Role = require('../models/role.model');
const Admin = require('../models/admin.model');
const sendEmail = require('../services/emailService');
const { v4: uuidv4 } = require('uuid');

// === UTILITY FUNCTIONS ===
const generateUserId = () => `USER-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
const generateUserIdUUID = () => `user_${uuidv4().slice(0, 8)}`;

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, userId: user.userId, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
};

const validatePassword = (password) => {
  if (!password || typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain at least one letter and one number.';
  }
  return null;
};

// === GOOGLE SSO ===
exports.registerOrLoginWithGoogle = async (req, res) => {
  try {
    const { googleId, email, name } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      const userId = generateUserId();
      const newUser = new User({
        userId,
        name,
        email,
        role: 'customer',
      });
      await newUser.save();
      return res.status(201).json({
        message: 'User registered via Google',
        token: generateAccessToken(newUser),
        refreshToken: generateRefreshToken(newUser._id),
        userId: newUser.userId,
      });
    }

    return res.json({
      message: 'Google login successful',
      token: generateAccessToken(user),
      refreshToken: generateRefreshToken(user._id),
      userId: user.userId,
    });
  } catch (error) {
    console.error('Google SSO Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.googleLogin = passport.authenticate('google', { scope: ['email', 'profile'] });

exports.googleCallback = [
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  async (req, res) => {
    try {
      const user = req.user;
      const token = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user._id);
      res.json({
        message: 'Google authentication successful',
        token,
        refreshToken,
        userId: user.userId,
      });
    } catch (error) {
      console.error('Google Callback Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
];

// === REGISTER CUSTOMER ===
exports.registerCustomer = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields (name, email, password) are required.' });
    }

    // Password validation
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const normalizedEmail = email.toLowerCase().trim();

    // Check if the email already exists
    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    // Create user
    const userId = generateUserId(); // Generate a unique user ID
    const newUser = new User({
      userId,
      name,
      email: normalizedEmail,
      password: password.trim(), // let the model handle hashing
      role: 'customer',
    });

    // Save user
    await newUser.save();

    // Generate tokens
    const token = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser._id);

    // Send welcome email (optional)
    await sendEmail(normalizedEmail, 'Welcome to Our Platform!', `Hello ${name},\nThank you for registering!\nYour User ID: ${userId}\nBest,\nThe Team`);

    // Respond with success
    res.status(201).json({
      message: 'Customer registered successfully',
      token,
      refreshToken,
      userId,
    });
  } catch (error) {
    console.error('Register Customer Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
// === LOGIN CUSTOMER ===
exports.loginCustomer = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', email, password);

    // Validate input
    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Check if the user exists
    if (!user) {
      console.log('User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if the user has a password (not using Google SSO)
    if (!user.password) {
      console.log('No password found, likely Google SSO');
      return res.status(403).json({ error: 'Use Google SSO for this account' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password.trim(), user.password);
    console.log('Password match:', isMatch);

    if (!isMatch) {
      console.log('Password mismatch');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user._id);

    console.log('Login success:', user.email);

    // Respond with user data and tokens
    res.json({
      message: 'Customer login successful',
      token,
      refreshToken,
      user: {
        id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login Customer Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// === REGISTER SELLER OR VENDOR ===
exports.registerSellerOrVendor = async (req, res) => {
  try {
    const { name, email, password, roleName, storeName, storeDescription } = req.body;
    if (!name || !email || !password || !roleName) {
      return res.status(400).json({ error: 'Name, email, password, and role are required.' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    if (!['seller', 'vendor'].includes(roleName)) {
      return res.status(400).json({ error: 'Role must be "seller" or "vendor".' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    // Directly using roleName from request as role is defined in User schema
    if (!['seller', 'vendor'].includes(roleName)) {
      return res.status(400).json({ error: 'Invalid role specified.' });
    }

    const userId = generateUserId();
    const newUser = new User({
      userId,
      name,
      email: normalizedEmail,
      password: password.trim(), // Using the plain password as hashing is in the schema
      role: roleName,
      sellerProfile: roleName === 'seller' ? { storeName, storeDescription } : undefined,
    });
    await newUser.save();

    const token = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser._id);

    await sendEmail(normalizedEmail, `Welcome, ${roleName}!`, `Hello ${name},\nYour ${roleName} account is created.\nUser ID: ${userId}\nBest,\nThe Team`);

    res.status(201).json({
      message: `${roleName} registered successfully`,
      userId,
      token,
      refreshToken,
    });
  } catch (error) {
    console.error('Register Seller/Vendor Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
// === LOGIN SELLER OR VENDOR ===
exports.loginSellerOrVendor = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !['seller', 'vendor'].includes(user.role)) {
      return res.status(403).json({ error: 'Access denied. Not a seller or vendor.' });
    }
    if (!user.password) return res.status(403).json({ error: 'Use Google SSO for this account' });

    // Correctly compare the provided password with the stored hashed password
    const isMatch = await user.comparePassword(password.trim());
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user._id);

    res.json({
      message: 'Seller/Vendor login successful',
      token,
      refreshToken,
      user: {
        id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        sellerProfile: user.sellerProfile,
      },
    });
  } catch (error) {
    console.error('Login Seller/Vendor Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
// === LOGIN ADMIN ===
exports.loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const admin = await Admin.findOne({ username });
    if (!admin || (admin.password !== password.trim())) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const token = generateAccessToken({ _id: admin._id, role: 'admin' });
    const refreshToken = generateRefreshToken(admin._id);

    res.json({
      message: 'Admin login successful',
      token,
      refreshToken,
    });
  } catch (error) {
    console.error('Login Admin Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// === PASSWORD MANAGEMENT ===
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const resetToken = jwt.sign({ id: user._id }, process.env.RESET_PASSWORD_SECRET, { expiresIn: '1h' });
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = Date.now() + 3600000; // 1 hour
    await user.save();

    await sendEmail(normalizedEmail, 'Password Reset Request', `Use this token to reset your password: ${resetToken}\nExpires in 1 hour.\nBest,\nThe Team`);

    res.json({ message: 'Password reset token sent to email' });
  } catch (error) {
    console.error('Request Password Reset Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'New password is required.' });

    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const decoded = jwt.verify(token, process.env.RESET_PASSWORD_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.resetPasswordExpiry < Date.now()) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    user.password = password.trim(); // Password will be hashed by the pre-save hook in the User model
    user.resetPasswordToken = null;
    user.resetPasswordExpiry = null;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old and new passwords are required.' });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const user = await User.findById(req.user.id);
    if (!user || !(await bcrypt.compare(oldPassword.trim(), user.password))) {
      return res.status(401).json({ error: 'Old password is incorrect' });
    }

    user.password = newPassword.trim(); // Password will be hashed by the pre-save hook in the User model
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change Password Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// === ADMIN AND TOKEN MANAGEMENT ===
exports.promoteToSellerOrVendor = async (req, res) => {
  try {
    const { userId, roleName, storeName, storeDescription } = req.body;
    if (!userId || !roleName) {
      return res.status(400).json({ error: 'User ID and role are required.' });
    }

    if (!['seller', 'vendor'].includes(roleName)) {
      return res.status(400).json({ error: 'Role must be "seller" or "vendor".' });
    }

    const user = await User.findById(userId);
    const role = await Role.findOne({ name: roleName });
    if (!user || !role) return res.status(404).json({ error: 'User or role not found' });

    user.role = role.name;
    user.sellerProfile = roleName === 'seller' ? { storeName, storeDescription } : undefined;
    await user.save();

    await sendEmail(user.email, 'Role Promotion', `Hello ${user.name},\nYou have been promoted to ${roleName}.\nBest,\nThe Team`);

    res.json({ message: `User promoted to ${roleName}` });
  } catch (error) {
    console.error('Promote to Seller/Vendor Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token is required.' });

    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, async (err, decoded) => {
      if (err) return res.status(403).json({ error: 'Invalid or expired refresh token' });

      const user = await User.findById(decoded.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const newToken = generateAccessToken(user);
      res.json({ token: newToken });
    });
  } catch (error) {
    console.error('Refresh Token Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.setFirstAdminAccount = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    if (await Admin.countDocuments() > 0) {
      return res.status(403).json({ error: 'Admin account already exists' });
    }

    const newAdmin = new Admin({ username, password: password.trim() }); // Admin model likely has its own hashing middleware
    await newAdmin.save();

    res.status(201).json({ message: 'First admin account created' });
  } catch (error) {
    console.error('Set First Admin Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.logout = (req, res) => {
  res.json({ message: 'Logged out successfully' });
};