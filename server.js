const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { setupSecurity, requestSizeLimiter, xssProtection } = require('./src/middleware/security');
const { setupLogging } = require('./src/middleware/logging');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');
const path = require('path');

dotenv.config();

const app = express();

// Security middleware
setupSecurity(app);

// Request size limiting
app.use(requestSizeLimiter());

// Serve static files with caching headers
app.use('/images', express.static(path.join(__dirname, 'public/images'), {
  maxAge: '1y', // Cache for 1 year
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Set appropriate content-type for images
    if (filePath.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    }
  }
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization
const { sanitizeRequestBody } = require('./src/middleware/sanitization');
app.use(sanitizeRequestBody);


// XSS protection
app.use(xssProtection);

// Logging (dev only in development)
setupLogging(app);

// Routes
app.use('/api/auth', require('./src/routes/auth')); 
app.use('/api/places', require('./src/routes/places'));
app.use('/api/checkins', require('./src/routes/checkins'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/rewards', require('./src/routes/rewards'));
app.use('/api/upload', require('./src/routes/upload'));

// Health check
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB', err);
    process.exit(1);
  });



