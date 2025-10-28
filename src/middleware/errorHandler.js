// Global error handler middleware

// Handle Mongoose validation errors
function handleValidationError(error) {
  const errors = Object.values(error.errors).map(err => err.message);
  return {
    success: false,
    message: 'Validation Error',
    errors: errors
  };
}

// Handle Mongoose duplicate key errors
function handleDuplicateKeyError(error) {
  const field = Object.keys(error.keyValue)[0];
  return {
    success: false,
    message: `${field} already exists`
  };
}

// Handle Mongoose cast errors (invalid ObjectId)
function handleCastError(error) {
  return {
    success: false,
    message: 'Invalid ID format'
  };
}

// Handle JWT errors
function handleJWTError() {
  return {
    success: false,
    message: 'Invalid token'
  };
}

// Handle JWT expired errors
function handleJWTExpiredError() {
  return {
    success: false,
    message: 'Token expired'
  };
}

// Main error handler middleware
function errorHandler(err, req, res, next) {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('Error:', err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    error = handleCastError(err);
    return res.status(400).json(error);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    error = handleDuplicateKeyError(err);
    return res.status(400).json(error);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    error = handleValidationError(err);
    return res.status(400).json(error);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
    return res.status(401).json(error);
  }

  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
    return res.status(401).json(error);
  }

  // Default to 500 server error
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

// 404 handler for undefined routes
function notFound(req, res, next) {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
}

module.exports = {
  errorHandler,
  notFound
};
