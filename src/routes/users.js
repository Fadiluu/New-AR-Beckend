const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { RewardHistory, User } = require('../../models');
const { validateObjectId } = require('../middleware/validation');
const validator = require('validator');
const bcrypt = require('bcryptjs');

// GET /api/users/:id/rewards -> return total points + detailed history
router.get('/:id/rewards', auth, validateObjectId, async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied. You can only view your own rewards.' 
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get detailed reward history with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const history = await RewardHistory.find({ userId: req.params.id })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalCount = await RewardHistory.countDocuments({ userId: req.params.id });

    // Calculate reward statistics
    const stats = await RewardHistory.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: null,
          totalEarned: { $sum: '$amount' },
          totalTransactions: { $sum: 1 },
          firstReward: { $min: '$timestamp' },
          lastReward: { $max: '$timestamp' }
        }
      }
    ]);

    const rewardStats = stats[0] || {
      totalEarned: 0,
      totalTransactions: 0,
      firstReward: null,
      lastReward: null
    };

    return res.json({
      success: true,
      message: 'Reward data retrieved successfully',
      data: {
        user: {
          id: user._id,
          firstName: user.profile.firstName,
          lastName: user.profile.lastName,
          username: user.login.username,
          totalPoints: user.rewardPoints.total
        },
        statistics: {
          totalPoints: user.rewardPoints.total,
          totalEarned: rewardStats.totalEarned,
          totalTransactions: rewardStats.totalTransactions,
          firstReward: rewardStats.firstReward,
          lastReward: rewardStats.lastReward
        },
        rewards: {
          history: history,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            totalItems: totalCount,
            itemsPerPage: limit,
            hasNext: page < Math.ceil(totalCount / limit),
            hasPrev: page > 1
          }
        }
      }
    });
  } catch (error) {
    console.error('Rewards query error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// GET /api/users/profile -> get current user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-login.password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: user
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// GET /api/users/leaderboard -> top 5 by points
router.get('/leaderboard', async (_req, res) => {
  try {
    const top = await User.find({})
      .select('profile.firstName profile.lastName login.username rewardPoints.total')
      .sort({ 'rewardPoints.total': -1 })
      .limit(3)
      .lean();
    return res.json({ success: true, data: top });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/users/profile -> update profile (name, email, picture, username, password)
router.put('/profile', auth, async (req, res) => {
  try {
    const { firstName, lastName, email, pictureUrl, username, password } = req.body;

    const updates = {};
    if (typeof firstName === 'string') updates['profile.firstName'] = firstName.trim();
    if (typeof lastName === 'string') updates['profile.lastName'] = lastName.trim();
    if (typeof email === 'string') {
      const trimmed = email.trim().toLowerCase();
      if (!validator.isEmail(trimmed)) {
        return res.status(400).json({ success: false, message: 'Invalid email' });
      }
      updates['profile.email'] = trimmed;
    }
    if (typeof pictureUrl === 'string') {
      const trimmedUrl = pictureUrl.trim();
      if (trimmedUrl) {
        // Allow full URLs (http://, https://) and relative paths (/images/...)
        const isFullUrl = validator.isURL(trimmedUrl, { require_protocol: false });
        const isRelativePath = trimmedUrl.startsWith('/images/');
        
        if (!isFullUrl && !isRelativePath) {
          return res.status(400).json({ success: false, message: 'Invalid picture URL format' });
        }
        updates['profile.pictureUrl'] = trimmedUrl;
      }
    }
    if (typeof username === 'string') {
      const trimmed = username.trim();
      if (trimmed.length < 3 || trimmed.length > 30) {
        return res.status(400).json({ success: false, message: 'Username must be between 3 and 30 characters' });
      }
      updates['login.username'] = trimmed;
    }
    if (typeof password === 'string') {
      const trimmed = password.trim();
      if (trimmed.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      }
      // Hash the password
      const hashedPassword = await bcrypt.hash(trimmed, 10);
      updates['login.password'] = hashedPassword;
    }

    // Ensure email uniqueness when changed
    if (updates['profile.email']) {
      const existing = await User.findOne({ _id: { $ne: req.user.id }, 'profile.email': updates['profile.email'] });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Email already in use' });
      }
    }

    // Ensure username uniqueness when changed
    if (updates['login.username']) {
      const existing = await User.findOne({ _id: { $ne: req.user.id }, 'login.username': updates['login.username'] });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Username already in use' });
      }
    }

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true, context: 'query' }
    ).select('-login.password');

    if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, message: 'Profile updated', data: updated });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/users/points -> current user points
router.get('/points', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('rewardPoints.total');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, points: user.rewardPoints.total });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add to your users.js or a dev-only route file
router.post('/make-admin/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { role: 'admin' } },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User promoted to admin', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// GET /api/users/is-admin -> check if current user is admin
router.get('/is-admin', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const isAdmin = user.role === 'admin';
    return res.json({ success: true, isAdmin });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Note: Reward redemption is now handled by /api/rewards/:id/redeem endpoint
// This endpoint is deprecated - use the new rewards system instead

module.exports = router;


