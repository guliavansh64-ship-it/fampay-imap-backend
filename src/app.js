'use strict';

const express = require('express');
const config = require('./config');
const { authenticateApiKey } = require('./auth');
const { testConnection, fetchRecentTransactions } = require('./imap-service');

const app = express();

// Basic security and parsing middleware
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Root Information Endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'FatafatPay FamPay IMAP Gateway',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      health: 'GET /api/health',
      testConnection: 'POST /api/test-connection',
      fetchTransactions: 'POST /api/fetch-transactions'
    }
  });
});

// 1. Health Check (Public - for uptime monitoring and Vercel health probes)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'fampay-imap-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: config.NODE_ENV,
    authConfigured: Boolean(config.API_KEY)
  });
});

// 2. Test Connection Endpoint (Authenticated)
app.post('/api/test-connection', authenticateApiKey, async (req, res) => {
  try {
    const email = req.body.email || config.GMAIL_USER;
    const appPassword = req.body.app_password || req.body.appPassword || config.GMAIL_APP_PASSWORD;

    if (!email || !appPassword) {
      return res.status(400).json({
        success: false,
        message: 'Gmail email address and App Password are required.'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address format.'
      });
    }

    const result = await testConnection({
      email: email.trim(),
      appPassword: appPassword.trim()
    });

    return res.status(result.success ? 200 : 200).json(result);
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error while testing IMAP connection.'
    });
  }
});

// 3. Fetch Transactions Endpoint (Authenticated)
app.post('/api/fetch-transactions', authenticateApiKey, async (req, res) => {
  try {
    const email = req.body.email || config.GMAIL_USER;
    const appPassword = req.body.app_password || req.body.appPassword || config.GMAIL_APP_PASSWORD;
    const days = parseInt(req.body.days || config.DEFAULT_SEARCH_DAYS, 10);
    const limit = parseInt(req.body.limit || config.DEFAULT_FETCH_LIMIT, 10);

    if (!email || !appPassword) {
      return res.status(400).json({
        success: false,
        count: 0,
        transactions: [],
        message: 'Gmail email address and App Password are required.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        count: 0,
        transactions: [],
        message: 'Invalid email address format.'
      });
    }

    const safeDays = Math.min(Math.max(days || 2, 1), 30);
    const safeLimit = Math.min(Math.max(limit || 30, 1), 100);

    const result = await fetchRecentTransactions({
      email: email.trim(),
      appPassword: appPassword.trim(),
      days: safeDays,
      limit: safeLimit
    });

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({
      success: false,
      count: 0,
      transactions: [],
      message: 'Internal server error while fetching transactions.'
    });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found: ' + req.method + ' ' + req.path
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON request body.'
    });
  }

  console.error('[SERVER ERROR]', err.message || err);
  res.status(500).json({
    success: false,
    message: 'An unexpected internal server error occurred.'
  });
});

module.exports = app;
