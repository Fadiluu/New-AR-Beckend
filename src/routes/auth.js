const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { User } = require('../../models');
const { validateRegistration, validateLogin } = require('../middleware/validation');
const { blacklistToken } = require('../middleware/tokenBlacklist');

// POST /api/auth/register -> create account with bcrypt hashing
router.post('/register', validateRegistration, async (req, res) => {
  try {
    console.log('Registration request body:', req.body);
    const { firstName, lastName, email, username, password } = req.body;

    // Check if user already exists
    const existing = await User.findOne({ 
      $or: [ 
        { 'profile.email': email }, 
        { 'login.username': username } 
      ] 
    });
    
    if (existing) {
      return res.status(409).json({ 
        success: false,
        message: 'User already exists' 
      });
    }

    // Create user (password will be hashed by pre-save hook)
    const user = await User.create({
      profile: { firstName, lastName, email },
      login: { username, password },
      rewardPoints: { total: 0 }
    });

    // Generate JWT token for immediate login
    const token = jwt.sign(
      { id: user._id, role: user.role || 'user' }, 
      process.env.JWT_SECRET || 'dev_secret', 
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(201).json({ 
      success: true,
      message: 'User created successfully',
      data: { 
        id: user._id,
        token,
        user: {
          id: user._id,
          firstName: user.profile.firstName,
          lastName: user.profile.lastName,
          email: user.profile.email,
          username: user.login.username,
          rewardPoints: user.rewardPoints.total
        }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// POST /api/auth/login -> login & return JWT
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ 'login.username': username });
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role || 'user' }, 
      process.env.JWT_SECRET || 'dev_secret', 
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.json({ 
      success: true,
      message: 'Login successful',
      data: { 
        token,
        user: {
          id: user._id,
          firstName: user.profile.firstName,
          lastName: user.profile.lastName,
          email: user.profile.email,
          username: user.login.username,
          rewardPoints: user.rewardPoints.total
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

module.exports = router;

// POST /api/auth/logout -> blacklist current token
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(400).json({ success: false, message: 'No token to logout' });
    }
    blacklistToken(token);
    return res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});


