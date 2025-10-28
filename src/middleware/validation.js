// Input validation middleware for various data types

// Validate email format
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate password strength
function validatePassword(password) {
  return password && password.length >= 6;
}

// Validate latitude and longitude
function validateCoordinates(lat, lng) {
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  return !isNaN(latNum) && !isNaN(lngNum) && 
         latNum >= -90 && latNum <= 90 && 
         lngNum >= -180 && lngNum <= 180;
}

// Validate required fields
function validateRequired(fields, data) {
  const missing = fields.filter(field => !data[field]);
  return missing.length === 0 ? null : missing;
}

// Registration validation
function validateRegistration(req, res, next) {
  const { firstName, lastName, email, username, password } = req.body;
  
  // Check required fields
  const required = ['firstName', 'lastName', 'email', 'username', 'password'];
  const missing = validateRequired(required, req.body);
  if (missing) {
    return res.status(400).json({
      success: false,
      message: `Missing required fields: ${missing.join(', ')}`
    });
  }

  // Validate email format
  if (!validateEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format'
    });
  }

  // Validate password strength
  if (!validatePassword(password)) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters long'
    });
  }

  // Validate username length
  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({
      success: false,
      message: 'Username must be between 3 and 30 characters'
    });
  }

  next();
}

// Login validation
function validateLogin(req, res, next) {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required'
    });
  }

  next();
}

// Place creation validation
function validatePlace(req, res, next) {
  const { name, description, location } = req.body;
  
  // Check required fields
  const required = ['name', 'description', 'location'];
  const missing = validateRequired(required, req.body);
  if (missing) {
    return res.status(400).json({
      success: false,
      message: `Missing required fields: ${missing.join(', ')}`
    });
  }

  // Validate location coordinates
  if (!location || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
    return res.status(400).json({
      success: false,
      message: 'Location must have valid coordinates array [longitude, latitude]'
    });
  }

  const [lng, lat] = location.coordinates;
  if (!validateCoordinates(lat, lng)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid coordinates. Latitude must be -90 to 90, longitude -180 to 180'
    });
  }

  next();
}

// Checkin validation
function validateCheckin(req, res, next) {
  const { placeId, coordinates } = req.body;
  
  if (!placeId) {
    return res.status(400).json({
      success: false,
      message: 'Place ID is required'
    });
  }

  if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
    return res.status(400).json({
      success: false,
      message: 'Coordinates must be an array [longitude, latitude]'
    });
  }

  const [lng, lat] = coordinates;
  if (!validateCoordinates(lat, lng)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid coordinates. Latitude must be -90 to 90, longitude -180 to 180'
    });
  }

  next();
}

// Query parameters validation for places
function validatePlacesQuery(req, res, next) {
  const { lat, lng, radius } = req.query;
  
  // If lat/lng provided, validate them
  if (lat !== undefined || lng !== undefined) {
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Both latitude and longitude are required for location-based search'
      });
    }

    if (!validateCoordinates(parseFloat(lat), parseFloat(lng))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates. Latitude must be -90 to 90, longitude -180 to 180'
      });
    }

    // Validate radius if provided
    if (radius !== undefined) {
      const radiusNum = parseInt(radius, 10);
      if (isNaN(radiusNum) || radiusNum <= 0 || radiusNum > 50000) {
        return res.status(400).json({
          success: false,
          message: 'Radius must be a positive number between 1 and 50000 meters'
        });
      }
    }
  }

  next();
}

// MongoDB ObjectId validation
function validateObjectId(req, res, next) {
  const { id } = req.params;
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  
  if (!objectIdRegex.test(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  next();
}

module.exports = {
  validateEmail,
  validatePassword,
  validateCoordinates,
  validateRequired,
  validateRegistration,
  validateLogin,
  validatePlace,
  validateCheckin,
  validatePlacesQuery,
  validateObjectId
};
