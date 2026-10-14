'use strict';

const app = require('./src/app');
const config = require('./src/config');

const server = app.listen(config.PORT, () => {
  console.log(`[FatafatPay Backend] IMAP Service running on port ${config.PORT} (env: ${config.NODE_ENV})`);
  console.log(`[FatafatPay Backend] Health check: http://localhost:${config.PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[FatafatPay Backend] SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[FatafatPay Backend] SIGINT received. Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});
