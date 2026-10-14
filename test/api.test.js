'use strict';

const assert = require('assert');
const app = require('../src/app');
const config = require('../src/config');

async function runApiTests() {
  console.log('--- Running API Endpoint Integration Tests ---');

  // Set a test key
  const testKey = 'test-api-key-for-endpoint-testing';
  config.API_KEY = testKey;
  config.NODE_ENV = 'production';

  // Start server on an ephemeral port
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Root Information endpoint
    {
      const res = await fetch(`${baseUrl}/`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, 'online');
      console.log('  ✔ Test 1: GET / returns 200 and service metadata');
    }

    // 2. Health check endpoint (Public)
    {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, 'ok');
      assert.strictEqual(data.service, 'fampay-imap-backend');
      console.log('  ✔ Test 2: GET /api/health returns 200 and status ok');
    }

    // 3. Security headers
    {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
      assert.strictEqual(res.headers.get('x-frame-options'), 'DENY');
      assert.strictEqual(res.headers.get('x-xss-protection'), '1; mode=block');
      console.log('  ✔ Test 3: Security headers correctly applied');
    }

    // 4. Test connection - Missing Auth Header
    {
      const res = await fetch(`${baseUrl}/api/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@gmail.com', app_password: 'pass' })
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      console.log('  ✔ Test 4: POST /api/test-connection rejected without API key (401)');
    }

    // 5. Test connection - Invalid Auth Header
    {
      const res = await fetch(`${baseUrl}/api/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'wrong-key-123'
        },
        body: JSON.stringify({ email: 'test@gmail.com', app_password: 'pass' })
      });
      assert.strictEqual(res.status, 401);
      console.log('  ✔ Test 5: POST /api/test-connection rejected with invalid API key (401)');
    }

    // 6. Test connection - Valid Auth but missing parameters
    {
      const res = await fetch(`${baseUrl}/api/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': testKey
        },
        body: JSON.stringify({})
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      console.log('  ✔ Test 6: POST /api/test-connection validates missing credentials (400)');
    }

    // 7. Test connection - Valid Auth but invalid email format
    {
      const res = await fetch(`${baseUrl}/api/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': testKey
        },
        body: JSON.stringify({ email: 'not-an-email', app_password: 'validpassword' })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      console.log('  ✔ Test 7: POST /api/test-connection validates invalid email format (400)');
    }

    // 8. Fetch transactions - Missing Auth Header
    {
      const res = await fetch(`${baseUrl}/api/fetch-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@gmail.com', app_password: 'pass' })
      });
      assert.strictEqual(res.status, 401);
      console.log('  ✔ Test 8: POST /api/fetch-transactions rejected without API key (401)');
    }

    // 9. Fetch transactions - Valid Auth but missing parameters
    {
      const res = await fetch(`${baseUrl}/api/fetch-transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testKey}`
        },
        body: JSON.stringify({})
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      console.log('  ✔ Test 9: POST /api/fetch-transactions validates missing parameters (400)');
    }

    // 10. Unknown route (404)
    {
      const res = await fetch(`${baseUrl}/api/non-existent-route`);
      assert.strictEqual(res.status, 404);
      console.log('  ✔ Test 10: Unknown routes safely return 404');
    }

    // 11. Malformed JSON payload handling
    {
      const res = await fetch(`${baseUrl}/api/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': testKey
        },
        body: '{"invalid": json'
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      console.log('  ✔ Test 11: Malformed JSON body returns clean 400');
    }

    console.log('All API Endpoint Tests Passed!\n');
  } finally {
    server.close();
  }
}

module.exports = runApiTests;

if (require.main === module) {
  runApiTests();
}
