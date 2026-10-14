'use strict';

const assert = require('assert');
const { authenticateApiKey, safeCompare } = require('../src/auth');
const config = require('../src/config');

function runAuthTests() {
  console.log('--- Running Authentication Tests ---');

  // Test 1: safeCompare
  {
    assert.strictEqual(safeCompare('secret123', 'secret123'), true);
    assert.strictEqual(safeCompare('secret123', 'secret124'), false);
    assert.strictEqual(safeCompare('secret123', 'short'), false);
    assert.strictEqual(safeCompare(null, 'secret'), false);
    console.log('  ✔ Test 1: Timing-safe comparison operates correctly');
  }

  // Test 2: authenticateApiKey middleware
  {
    // Save original API key and env
    const origKey = config.API_KEY;
    const origEnv = config.NODE_ENV;

    config.API_KEY = 'test-secret-key-32chars-long-123';
    config.NODE_ENV = 'production';

    // Subtest: missing key
    let resStatus = 0;
    let resData = null;
    let nextCalled = false;

    const fakeReq1 = { headers: {} };
    const fakeRes1 = {
      status(s) { resStatus = s; return this; },
      json(d) { resData = d; return this; }
    };
    authenticateApiKey(fakeReq1, fakeRes1, () => { nextCalled = true; });

    assert.strictEqual(resStatus, 401, 'Missing key should return 401');
    assert.strictEqual(resData.success, false);
    assert.strictEqual(nextCalled, false);
    console.log('  ✔ Test 2: Missing API key rejected with 401');

    // Subtest: invalid key
    resStatus = 0;
    resData = null;
    nextCalled = false;
    const fakeReq2 = { headers: { 'x-api-key': 'wrong-key' } };
    authenticateApiKey(fakeReq2, fakeRes1, () => { nextCalled = true; });

    assert.strictEqual(resStatus, 401, 'Wrong key should return 401');
    assert.strictEqual(nextCalled, false);
    console.log('  ✔ Test 3: Wrong API key rejected with 401');

    // Subtest: valid x-api-key header
    nextCalled = false;
    const fakeReq3 = { headers: { 'x-api-key': 'test-secret-key-32chars-long-123' } };
    authenticateApiKey(fakeReq3, fakeRes1, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true, 'Valid X-API-Key should call next()');
    console.log('  ✔ Test 4: Valid X-API-Key authorized successfully');

    // Subtest: valid Bearer Authorization header
    nextCalled = false;
    const fakeReq4 = { headers: { authorization: 'Bearer test-secret-key-32chars-long-123' } };
    authenticateApiKey(fakeReq4, fakeRes1, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true, 'Valid Bearer token should call next()');
    console.log('  ✔ Test 5: Valid Authorization: Bearer authorized successfully');

    // Restore
    config.API_KEY = origKey;
    config.NODE_ENV = origEnv;
  }

  console.log('All Authentication Tests Passed!\n');
}

module.exports = runAuthTests;

if (require.main === module) {
  runAuthTests();
}
