const validator = require('validator');

// Sanitize string inputs to prevent XSS and injection attacks
function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  
  return validator.escape(input.trim());
}

// Sanitize reward names (less aggressive - preserve apostrophes and common punctuation)
function sanitizeRewardName(input) {
  if (typeof input !== 'string') return input;
  
  // Only remove dangerous characters, preserve apostrophes and common punctuation
  return input.trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframes
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '') // Remove objects
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, ''); // Remove embeds
}

// Sanitize email input
function sanitizeEmail(email) {
  if (typeof email !== 'string') return email;
  
  return validator.normalizeEmail(email.trim().toLowerCase());
}

// Sanitize username input
function sanitizeUsername(username) {
  if (typeof username !== 'string') return username;
  
  // Remove special characters, keep only alphanumeric and underscores
  return username.trim().replace(/[^a-zA-Z0-9_]/g, '');
}

// Sanitize text input (for descriptions, comments, etc.)
function sanitizeText(input) {
  if (typeof input !== 'string') return input;
  
  // Remove HTML tags and escape special characters
  return validator.escape(validator.stripLow(input.trim()));
}

// Sanitize coordinates array
function sanitizeCoordinates(coords) {
  if (!Array.isArray(coords) || coords.length !== 2) return coords;
  
  const [lng, lat] = coords;
  return [
    parseFloat(lng) || 0,
    parseFloat(lat) || 0
  ];
}

// Sanitize MongoDB ObjectId
function sanitizeObjectId(id) {
  if (typeof id !== 'string') return id;
  
  // Remove any non-hex characters
  return id.replace(/[^a-fA-F0-9]/g, '');
}

// Sanitize numeric input
function sanitizeNumber(input, min = null, max = null) {
  const num = parseFloat(input);
  if (isNaN(num)) return null;
  
  if (min !== null && num < min) return min;
  if (max !== null && num > max) return max;
  
  return num;
}

// Sanitize request body
function sanitizeRequestBody(req, res, next) {
  if (req.body) {
    // Sanitize common string fields
    if (req.body.firstName) req.body.firstName = sanitizeString(req.body.firstName);
    if (req.body.lastName) req.body.lastName = sanitizeString(req.body.lastName);
    if (req.body.email) req.body.email = sanitizeEmail(req.body.email);
    if (req.body.username) req.body.username = sanitizeUsername(req.body.username);
    
    // Check if this is a reward-related request and use appropriate sanitization
    if (req.path.includes('/rewards')) {
      // Use less aggressive sanitization for all reward fields to preserve apostrophes and punctuation
      if (req.body.name) req.body.name = sanitizeRewardName(req.body.name);
      if (req.body.shortDescription) req.body.shortDescription = sanitizeRewardName(req.body.shortDescription);
      if (req.body.description) req.body.description = sanitizeRewardName(req.body.description);
      if (req.body.terms) req.body.terms = sanitizeRewardName(req.body.terms);
      
      // Sanitize image captions
      if (req.body.images && Array.isArray(req.body.images)) {
        req.body.images = req.body.images.map(image => {
          if (image && typeof image === 'object') {
            if (image.caption && typeof image.caption === 'string') {
              image.caption = sanitizeRewardName(image.caption);
            }
            if (image.url && typeof image.url === 'string') {
              image.url = sanitizeRewardName(image.url);
            }
          }
          return image;
        });
      }
    } else {
      // Use standard sanitization for other routes
      if (req.body.name) req.body.name = sanitizeString(req.body.name);
      if (req.body.description) req.body.description = sanitizeText(req.body.description);
    }
    
    if (req.body.reason) req.body.reason = sanitizeText(req.body.reason);
    
    // Sanitize termsAndConditions array
    if (req.body.termsAndConditions && Array.isArray(req.body.termsAndConditions)) {
      req.body.termsAndConditions = req.body.termsAndConditions.map(term => 
        typeof term === 'string' ? (req.path.includes('/rewards') ? sanitizeRewardName(term) : sanitizeText(term)) : term
      );
    }
    
    // Sanitize coordinates
    if (req.body.coordinates) {
      req.body.coordinates = sanitizeCoordinates(req.body.coordinates);
    }
    
    if (req.body.location && req.body.location.coordinates) {
      req.body.location.coordinates = sanitizeCoordinates(req.body.location.coordinates);
    }
    
    // Sanitize numeric fields
    if (req.body.radius) {
      req.body.radius = sanitizeNumber(req.body.radius, 1, 50000);
    }
    
    if (req.body.lat) {
      req.body.lat = sanitizeNumber(req.body.lat, -90, 90);
    }
    
    if (req.body.lng) {
      req.body.lng = sanitizeNumber(req.body.lng, -180, 180);
    }
    
    // Sanitize pagination
    if (req.body.page) {
      req.body.page = sanitizeNumber(req.body.page, 1, 1000);
    }
    
    if (req.body.limit) {
      req.body.limit = sanitizeNumber(req.body.limit, 1, 100);
    }
  }
  
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key]);
      }
    });
  }
  
  // Sanitize URL parameters
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      if (typeof req.params[key] === 'string') {
        if (key === 'id') {
          req.params[key] = sanitizeObjectId(req.params[key]);
        } else {
          req.params[key] = sanitizeString(req.params[key]);
        }
      }
    });
  }
  
  next();
}

// Sanitize specific field types
function sanitizeField(fieldName, sanitizer) {
  return (req, res, next) => {
    if (req.body && req.body[fieldName]) {
      req.body[fieldName] = sanitizer(req.body[fieldName]);
    }
    next();
  };
}

// Remove potentially dangerous characters
function removeDangerousChars(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframes
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '') // Remove objects
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, ''); // Remove embeds
}

// Validate and sanitize file uploads
function sanitizeFileUpload(req, res, next) {
  if (req.file || req.files) {
    // Add file validation logic here
    // Check file type, size, etc.
  }
  next();
}

module.exports = {
  sanitizeString,
  sanitizeRewardName,
  sanitizeEmail,
  sanitizeUsername,
  sanitizeText,
  sanitizeCoordinates,
  sanitizeObjectId,
  sanitizeNumber,
  sanitizeRequestBody,
  sanitizeField,
  removeDangerousChars,
  sanitizeFileUpload
};
