const router = require('express').Router();
const { Place, User, RewardHistory } = require('../../models');
const { auth, adminOnly } = require('../middleware/auth');
const { validatePlace, validatePlacesQuery, validateObjectId } = require('../middleware/validation');

// GET /api/places?lat=&lng=&radius= -> query nearby places using $nearSphere
router.get('/', validatePlacesQuery, async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = parseInt(req.query.radius || '1000', 10);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      // Use $nearSphere for accurate GPS-based distance calculations
      const places = await Place.find({
        location: {
          $nearSphere: {
            $geometry: { 
              type: 'Point', 
              coordinates: [lng, lat] 
            },
            $maxDistance: radius // radius in meters
          }
        }
      })
      .limit(50)
      .lean(); // Use lean() for better performance

      // Add distance calculation to each place
      const placesWithDistance = places.map(place => {
        const distance = calculateDistance(
          lat, lng, 
          place.location.coordinates[1], 
          place.location.coordinates[0]
        );
        return {
          ...place,
          distance: Math.round(distance) // distance in meters
        };
      });

      return res.json({
        success: true,
        message: 'Nearby places retrieved successfully',
        data: placesWithDistance,
        count: placesWithDistance.length,
        searchCenter: { lat, lng },
        searchRadius: radius
      });
    }

    // Fallback: return all places if no coordinates provided
    const all = await Place.find({}).limit(100).lean();
    return res.json({
      success: true,       
      message: 'All places retrieved successfully',
      data: all,
      count: all.length
    });
  } catch (error) {
    console.error('Places query error:', error);
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

// GET /api/places/:id -> details for one POI
router.get('/:id', validateObjectId, async (req, res) => {
  try {
    const place = await Place.findById(req.params.id);
    if (!place) {
      return res.status(404).json({ 
        success: false,
        message: 'Place not found' 
      });
    }
    
    return res.json({
      success: true,
      message: 'Place retrieved successfully',
      data: place
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// POST /api/places -> add POI (admin only)
router.post('/', auth, adminOnly, validatePlace, async (req, res) => {
  try {
    const { name, description, location, images, redemption } = req.body;
    
    const place = await Place.create({ 
      name, 
      description,
      location, 
      images: images || [],
      redemption: redemption || { eligible: false, pointsCost: 0 }
    });
    
    return res.status(201).json({
      success: true,
      message: 'Place created successfully',
      data: place
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// POST /api/places/:id/bookmark -> add bookmark
router.post('/:id/bookmark', auth, validateObjectId, async (req, res) => {
  try {
    const place = await Place.findById(req.params.id).select('_id name');
    if (!place) return res.status(404).json({ success: false, message: 'Place not found' });

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { bookmarks: place._id } },
      { new: true }
    ).select('bookmarks');

    return res.json({ success: true, message: 'Bookmarked', data: { bookmarks: updated.bookmarks } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/places/bookmarks/me -> list bookmarks populated
router.get('/bookmarks/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('bookmarks');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, data: user.bookmarks });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/places/:id/bookmark -> remove bookmark
router.delete('/:id/bookmark', auth, validateObjectId, async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { bookmarks: req.params.id } },
      { new: true }
    ).select('bookmarks');
    return res.json({ success: true, message: 'Bookmark removed', data: { bookmarks: updated.bookmarks } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/places/:id/redeem -> redeem points at eligible place (awards points to user)
router.post('/:id/redeem', auth, validateObjectId, async (req, res) => {
  try {
    const place = await Place.findById(req.params.id).select('name redemption');
    if (!place) return res.status(404).json({ success: false, message: 'Place not found' });

    if (!place.redemption || !place.redemption.eligible) {
      return res.status(400).json({ success: false, message: 'Place not eligible for redemption' });
    }

    const pointsAwarded = place.redemption.pointsCost || 0;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Award points to user
    user.rewardPoints.total += pointsAwarded;
    await user.save();

    // Log positive reward history
    await RewardHistory.create({
      userId: user._id,
      amount: pointsAwarded,
      reason: `Redeemed at ${place.name}`,
      timestamp: new Date()
    });

    return res.json({ 
      success: true, 
      message: 'Redemption successful! Points awarded.', 
      data: { 
        pointsAwarded,
        totalPoints: user.rewardPoints.total 
      } 
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== ADMIN ENDPOINTS ====================

// GET /api/places/admin/all -> get all places for admin
router.get('/admin/all', auth, adminOnly, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const places = await Place.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalCount = await Place.countDocuments({});

    return res.json({
      success: true,
      message: 'All places retrieved successfully',
      data: places,
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
    console.error('Admin places query error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// DELETE /api/places/:id -> delete place (admin only)
router.delete('/:id', auth, adminOnly, validateObjectId, async (req, res) => {
  try {
    const place = await Place.findByIdAndDelete(req.params.id);
    
    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'Place not found'
      });
    }

    return res.json({
      success: true,
      message: 'Place deleted successfully'
    });
  } catch (error) {
    console.error('Place deletion error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

module.exports = router;


