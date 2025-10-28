const morgan = require('morgan');

// Custom morgan token for request ID
morgan.token('reqId', (req) => req.id || 'unknown');

// Custom morgan token for user ID
morgan.token('userId', (req) => req.user ? req.user.id : 'anonymous');

// Custom morgan token for response time in ms
morgan.token('responseTime', (req, res) => {
  if (!req._startTime || !res._startTime) {
    return '0';
  }
  const ms = (res._startTime - req._startTime) * 1000;
  return ms.toFixed(3);
});

// Development logging format
const devFormat = ':method :url :status :response-time ms - :res[content-length] - :userId';

// Production logging format (more structured)
const prodFormat = JSON.stringify({
  timestamp: ':date[iso]',
  method: ':method',
  url: ':url',
  status: ':status',
  responseTime: ':response-time ms',
  contentLength: ':res[content-length]',
  userAgent: ':user-agent',
  userId: ':userId',
  ip: ':remote-addr'
});

// Error logging format
const errorFormat = JSON.stringify({
  timestamp: ':date[iso]',
  level: 'ERROR',
  method: ':method',
  url: ':url',
  status: ':status',
  responseTime: ':response-time ms',
  userId: ':userId',
  ip: ':remote-addr',
  userAgent: ':user-agent',
  error: ':error-message'
});

// Skip logging for health checks and static files
const skipLogging = (req, res) => {
  return req.url === '/health' || 
         req.url.startsWith('/static/') ||
         res.statusCode >= 400; // Don't log errors here, they're handled by error handler
};

// Development logger
function createDevLogger() {
  return morgan(devFormat, {
    skip: skipLogging,
    stream: process.stdout
  });
}

// Production logger
function createProdLogger() {
  return morgan(prodFormat, {
    skip: skipLogging,
    stream: process.stdout
  });
}

// Error logger
function createErrorLogger() {
  return morgan(errorFormat, {
    skip: (req, res) => res.statusCode < 400,
    stream: process.stderr
  });
}

// Request ID middleware
function addRequestId(req, res, next) {
  req.id = Math.random().toString(36).substr(2, 9);
  req._startTime = Date.now();
  res._startTime = Date.now();
  next();
}

// Request timing middleware
function addTiming(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    res.locals.responseTime = duration;
  });
  
  next();
}

// Setup logging based on environment
function setupLogging(app) {
  // Add request ID and timing
  app.use(addRequestId);
  app.use(addTiming);
  
  // Setup morgan based on environment
  if (process.env.NODE_ENV === 'production') {
    app.use(createProdLogger());
    app.use(createErrorLogger());
  } else {
    app.use(createDevLogger());
  }
  
  return app;
}

module.exports = {
  createDevLogger,
  createProdLogger,
  createErrorLogger,
  addRequestId,
  addTiming,
  setupLogging
};
