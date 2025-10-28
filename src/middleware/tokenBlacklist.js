// Simple in-memory token blacklist. Suitable for single-instance deployments.
// For production with multiple instances, replace with Redis or database-backed store.

const blacklistedTokens = new Set();

function blacklistToken(token) {
  if (typeof token === 'string' && token.length > 0) {
    blacklistedTokens.add(token);
  }
}

function isTokenBlacklisted(token) {
  return blacklistedTokens.has(token);
}

module.exports = { blacklistToken, isTokenBlacklisted };


