'use strict';

/**
 * Configuration module for FamPay IMAP Backend
 * Loads settings from environment variables with safe defaults.
 */

try {
  require('dotenv').config();
} catch (e) {
  // Ignore if dotenv is not present or in serverless environment
}

const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),

  // API Authentication Token (Must be shared between PHP and this backend)
  API_KEY: process.env.FAMPAY_BACKEND_KEY || process.env.API_KEY || 'fatafatpay_local_test_key_2026',

  // Gmail IMAP Server Defaults
  GMAIL_HOST: process.env.GMAIL_HOST || 'imap.gmail.com',
  GMAIL_PORT: parseInt(process.env.GMAIL_PORT || '993', 10),
  GMAIL_SECURE: process.env.GMAIL_SECURE !== 'false',

  // Optional Default / Fallback Mailbox Credentials (if not sent in request)
  GMAIL_USER: process.env.GMAIL_USER || '',
  GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD || '',

  // Connection & Execution Timeouts
  IMAP_TIMEOUT_MS: parseInt(process.env.IMAP_TIMEOUT_MS || '12000', 10),

  // Search parameters
  DEFAULT_SEARCH_DAYS: parseInt(process.env.SEARCH_DAYS || '2', 10),
  DEFAULT_FETCH_LIMIT: parseInt(process.env.FETCH_LIMIT || '30', 10),
};

module.exports = config;
