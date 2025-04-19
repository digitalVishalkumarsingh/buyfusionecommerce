const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user.model');
const { generateUserId, generateToken, generateRefreshToken } = require('./authController');
const sendEmail = require('../services/emailService');

// Setup passport to handle Google authentication
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (token, tokenSecret, profile, done) => {
  try {
    // Check if user exists in DB
    let user = await User.findOne({ email: profile.emails[0].value.toLowerCase() });

    if (!user) {
      // If user doesn't exist, create a new user
      const userId = generateUserId();
      const newUser = new User({
        userId,
        name: profile.displayName,
        email: profile.emails[0].value.toLowerCase(),
        password: '',  // SSO user won't need a password
        role: 'customer',  // Default role for new SSO users
      });
      
      await newUser.save();

      // Send a welcome email
      await sendEmail(newUser.email, 'Welcome to Our Platform!', `Hello ${newUser.name},\n\nThanks for registering with Google.\nYour User ID: ${userId}\n\n- Team`);

      user = newUser;
    }

    // Generate token and refresh token
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user._id);

    done(null, { token, refreshToken, userId: user.userId });
  } catch (err) {
    done(err, null);
  }
}));

// Serialize and deserialize user for sessions
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
