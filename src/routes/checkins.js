const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { Checkin, Place, User, RewardHistory } = require('../../models');
const { validateCheckin, validateObjectId } = require('../middleware/validation');

// POST /api/checkins -> verify distance (10-20m), save checkin, update points, log history
router.post('/', auth, validateCheckin, async (req, res) => {
  try {
    const { placeId, coordinates } = req.body; // coordinates: [lng, lat]

    const place = await Place.findById(placeId);
    if (!place) {
      return res.status(404).json({ 
        success: false,
        message: 'Place not found' 
      });
    }

    // Calculate precise distance using Haversine formula
    const [lng, lat] = coordinates;
    const distance = calculateDistance(
      lat, lng,
      place.location.coordinates[1], 
      place.location.coordinates[0]
    );
    
    // Verify distance is within 10-20 meters
    if (distance > 20) {
      return res.status(400).json({ 
        success: false,
        message: `Too far from place. You are ${Math.round(distance)}m away. Must be within 20 meters.` 
      });
    }

    if (distance < 10) {
      return res.status(400).json({ 
        success: false,
        message: `Too close to place. You are ${Math.round(distance)}m away. Must be at least 10 meters away.` 
      });
    }

    // Check if user already checked in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingCheckin = await Checkin.findOne({
      userId: req.user.id,
      placeId: place._id,
      timestamp: { $gte: today, $lt: tomorrow }
    });

    if (existingCheckin) {
      return res.status(409).json({
        success: false,
        message: 'Already checked in at this place today'
      });
    }

    // Create checkin record
    const checkin = await Checkin.create({
      userId: req.user.id,
      placeId: place._id,
      location: { type: 'Point', coordinates: [lng, lat] },
      timestamp: new Date()
    });

    // Update user reward points
    const user = await User.findById(req.user.id);
    const pointsAwarded = 10; // Base points for check-in
    user.rewardPoints.total += pointsAwarded;
    await user.save();

    // Log in reward history
    await RewardHistory.create({
      userId: user._id,
      amount: pointsAwarded,
      reason: `Check-in at ${place.name}`,
      timestamp: new Date()
    });

    return res.status(201).json({ 
      success: true,
      message: 'Check-in successful! Points awarded.',
      data: { 
        checkinId: checkin._id,
        place: {
          id: place._id,
          name: place.name,
          distance: Math.round(distance)
        },
        points: {
          awarded: pointsAwarded,
          total: user.rewardPoints.total
        },
        timestamp: checkin.timestamp
      }
    });
  } catch (error) {
    console.error('Check-in error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// Helper function to calculate distance between two GPS coordinates
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

// GET /api/checkins -> get user's checkins
router.get('/', auth, async (req, res) => {
  try {
    const checkins = await Checkin.find({ userId: req.user.id })
      .populate('placeId', 'name description location images')
      .sort({ timestamp: -1 })
      .limit(50);

    return res.json({
      success: true,
      message: 'Check-ins retrieved successfully',
      data: checkins,
      count: checkins.length
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

module.exports = router;


