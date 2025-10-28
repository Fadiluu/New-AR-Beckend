const jwt = require('jsonwebtoken');
const { User } = require('../../models');
const { isTokenBlacklisted } = require('./tokenBlacklist');

// Enhanced JWT authentication middleware with user lookup
async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    if (isTokenBlacklisted(token)) {
      return res.status(401).json({ success: false, message: 'Token invalidated.' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    const user = await User.findById(decoded.id).select('-login.password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token. User not found.' 
      });
    }

    req.user = { id: user._id, role: user.role || 'user' };
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token.' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired.' 
      });
    }
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication error.' 
    });
  }
}

// Admin-only access middleware
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Admin privileges required.' 
    });
  }
  next();
}

// Optional auth middleware (doesn't fail if no token)
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
      const user = await User.findById(decoded.id).select('-login.password');
      if (user) {
        req.user = { id: user._id, role: user.role || 'user' };
      }
    }
    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
}

module.exports = { auth, adminOnly, optionalAuth };



