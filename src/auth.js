'use strict';

const crypto = require('crypto');
const config = require('./config');

/**
 * Timing-safe string comparison
 */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Express middleware to authenticate API requests via API key
 */
function authenticateApiKey(req, res, next) {
  const configuredKey = config.API_KEY;

  // If no API key is configured on server, reject all requests in production
  if (!configuredKey) {
    if (config.NODE_ENV === 'production') {
      return res.status(500).json({
        success: false,
        message: 'Server error: FAMPAY_BACKEND_KEY environment variable is not configured on the backend.'
      });
    }
    // In development mode, allow if explicitly set to allow development bypass or warn
    console.warn('[SECURITY WARNING] FAMPAY_BACKEND_KEY is not set. All requests are currently unauthenticated.');
    return next();
  }

  // Extract key from X-API-Key header or Authorization: Bearer <key>
  let providedKey = req.headers['x-api-key'] || req.headers['x-auth-token'];
  if (!providedKey && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      providedKey = parts[1];
    }
  }

  if (!providedKey || !safeCompare(providedKey.trim(), configuredKey.trim())) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or missing API key.'
    });
  }

  next();
}

module.exports = {
  authenticateApiKey,
  safeCompare
};
