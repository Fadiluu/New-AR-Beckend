const router = require('express').Router();
const { Reward, User, RewardHistory } = require('../../models');
const { auth, adminOnly } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validation');

// ==================== USER ENDPOINTS ====================

// GET /api/rewards -> get all active rewards (public)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const type = req.query.type;

    const filter = { isActive: true };
    if (type) filter.type = type;

    const rewards = await Reward.find(filter)
      .select('name shortDescription description termsAndConditions pointsCost type images validUntil')
      .sort({ pointsCost: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalCount = await Reward.countDocuments(filter);

    return res.json({
      success: true,
      message: 'Rewards retrieved successfully',
      data: rewards,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1
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

// GET /api/rewards/:id -> get specific reward details
router.get('/:id', validateObjectId, async (req, res) => {
  try {
    const reward = await Reward.findById(req.params.id);
    if (!reward) {
      return res.status(404).json({ 
        success: false,
        message: 'Reward not found' 
      });
    }

    if (!reward.isActive) {
      return res.status(404).json({ 
        success: false,
        message: 'Reward not available' 
      });
    }
    
    return res.json({
      success: true,
      message: 'Reward retrieved successfully',
      data: reward
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// POST /api/rewards/:id/redeem -> redeem a reward (requires auth)
router.post('/:id/redeem', auth, validateObjectId, async (req, res) => {
  try {
    const reward = await Reward.findById(req.params.id);
    if (!reward) {
      return res.status(404).json({ 
        success: false,
        message: 'Reward not found' 
      });
    }

    if (!reward.isActive) {
      return res.status(400).json({ 
        success: false,
        message: 'Reward is not available' 
      });
    }

    // Check if reward has expired
    if (reward.validUntil && new Date() > reward.validUntil) {
      return res.status(400).json({ 
        success: false,
        message: 'Reward has expired' 
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Check if user has enough points
    if (user.rewardPoints.total < reward.pointsCost) {
      return res.status(400).json({ 
        success: false,
        message: `Insufficient points. You need ${reward.pointsCost} points but have ${user.rewardPoints.total}` 
      });
    }

    // Deduct points
    user.rewardPoints.total -= reward.pointsCost;
    
    // Add the redeemed reward to user's rewards array
    user.rewards.push({
      name: reward.name,
      shortDescription: reward.shortDescription,
      pointsCost: reward.pointsCost,
      redeemedAt: new Date()
    });
    
    await user.save();

    // Log the redemption in reward history
    await RewardHistory.create({
      userId: user._id,
      amount: -reward.pointsCost,
      reason: `Redeemed reward: ${reward.name}`,
      timestamp: new Date()
    });

    return res.json({ 
      success: true,
      message: 'Reward redeemed successfully!',
      data: { 
        reward: {
          id: reward._id,
          name: reward.name,
          shortDescription: reward.shortDescription,
          type: reward.type,
          pointsCost: reward.pointsCost
        },
        user: {
          remainingPoints: user.rewardPoints.total
        }
      }
    });
  } catch (error) {
    console.error('Reward redemption error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// ==================== ADMIN ENDPOINTS ====================

// POST /api/rewards -> create new reward (admin only)
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { name, shortDescription, description, termsAndConditions, pointsCost, type, images, isActive, validUntil, terms } = req.body;

    // Validate required fields
    if (!name || !shortDescription || !description || !pointsCost || !type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, shortDescription, description, pointsCost, type'
      });
    }

    // Validate points cost
    if (pointsCost < 1) {
      return res.status(400).json({
        success: false,
        message: 'Points cost must be at least 1'
      });
    }

    // Validate type
    const validTypes = ['voucher', 'discount', 'coupon', 'gift', 'experience', 'other'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Validate termsAndConditions is array if provided
    if (termsAndConditions && !Array.isArray(termsAndConditions)) {
      return res.status(400).json({
        success: false,
        message: 'termsAndConditions must be an array'
      });
    }

    const reward = await Reward.create({
      name: name.trim(),
      shortDescription: shortDescription.trim(),
      description: description.trim(),
      termsAndConditions: termsAndConditions || [],
      pointsCost,
      type,
      images: images || [],
      isActive: isActive !== undefined ? isActive : true,
      validUntil: validUntil ? new Date(validUntil) : null,
      terms: terms ? terms.trim() : null
    });

    return res.status(201).json({
      success: true,
      message: 'Reward created successfully',
      data: reward
    });
  } catch (error) {
    console.error('Reward creation error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// PUT /api/rewards/:id -> update reward (admin only)
router.put('/:id', auth, adminOnly, validateObjectId, async (req, res) => {
  try {
    const { name, shortDescription, description, termsAndConditions, pointsCost, type, images, isActive, validUntil, terms } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (shortDescription !== undefined) updateData.shortDescription = shortDescription.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (termsAndConditions !== undefined) {
      if (!Array.isArray(termsAndConditions)) {
        return res.status(400).json({
          success: false,
          message: 'termsAndConditions must be an array'
        });
      }
      updateData.termsAndConditions = termsAndConditions;
    }
    if (pointsCost !== undefined) {
      if (pointsCost < 1) {
        return res.status(400).json({
          success: false,
          message: 'Points cost must be at least 1'
        });
      }
      updateData.pointsCost = pointsCost;
    }
    if (type !== undefined) {
      const validTypes = ['voucher', 'discount', 'coupon', 'gift', 'experience', 'other'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid type. Must be one of: ${validTypes.join(', ')}`
        });
      }
      updateData.type = type;
    }
    if (images !== undefined) updateData.images = images;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (validUntil !== undefined) updateData.validUntil = validUntil ? new Date(validUntil) : null;
    if (terms !== undefined) updateData.terms = terms ? terms.trim() : null;

    const reward = await Reward.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!reward) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found'
      });
    }

    return res.json({
      success: true,
      message: 'Reward updated successfully',
      data: reward
    });
  } catch (error) {
    console.error('Reward update error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// DELETE /api/rewards/:id -> delete reward (admin only)
router.delete('/:id', auth, adminOnly, validateObjectId, async (req, res) => {
  try {
    const reward = await Reward.findByIdAndDelete(req.params.id);
    
    if (!reward) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found'
      });
    }

    return res.json({
      success: true,
      message: 'Reward deleted successfully'
    });
  } catch (error) {
    console.error('Reward deletion error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// GET /api/rewards/admin/all -> get all rewards for admin (including inactive)
router.get('/admin/all', auth, adminOnly, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const rewards = await Reward.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalCount = await Reward.countDocuments({});

    return res.json({
      success: true,
      message: 'All rewards retrieved successfully',
      data: rewards,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Admin rewards query error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

module.exports = router;
