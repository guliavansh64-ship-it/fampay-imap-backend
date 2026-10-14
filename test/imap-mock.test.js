'use strict';

const assert = require('assert');
const { formatImapError, testConnection } = require('../src/imap-service');

async function runImapMockTests() {
  console.log('--- Running IMAP Error Handling & Verification Tests ---');

  // Test 1: formatImapError with Authentication Failed
  {
    const err = { code: 'AuthenticationFailed', message: 'Authentication failed' };
    const msg = formatImapError(err);
    assert.ok(msg.includes('Invalid Email or App Password'), 'Should identify authentication failure');
    console.log('  ✔ Test 1: Authentication failure formatted correctly');
  }

  // Test 2: formatImapError with Gmail Invalid credentials responseText
  {
    const err = { message: 'Command failed', responseStatus: 'NO', responseText: 'Invalid credentials (Failure)' };
    const msg = formatImapError(err);
    assert.ok(msg.includes('Invalid Email or App Password'), 'Should identify Gmail responseText invalid credentials');
    console.log('  ✔ Test 2: Gmail responseText credentials error formatted correctly');
  }

  // Test 3: formatImapError with Timeout
  {
    const err = { code: 'ETIMEDOUT', message: 'Connection timed out' };
    const msg = formatImapError(err);
    assert.ok(msg.includes('timed out'), 'Should identify timeout');
    console.log('  ✔ Test 3: Connection timeout formatted correctly');
  }

  // Test 4: formatImapError with DNS error
  {
    const err = { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND imap.gmail.com' };
    const msg = formatImapError(err);
    assert.ok(msg.includes('DNS or network error'), 'Should identify DNS/network error');
    console.log('  ✔ Test 4: DNS/network resolution error formatted correctly');
  }

  // Test 5: Missing credentials parameter validation
  {
    const res = await testConnection({});
    assert.strictEqual(res.success, false);
    assert.ok(res.message.includes('required'));
    console.log('  ✔ Test 5: Missing credentials safely rejected without connection attempt');
  }

  // Test 6: Live Gmail Handshake with invalid credentials (verifies real TLS & error rejection)
  {
    const res = await testConnection({
      email: 'fatafatpay_test_dummy_user_999@gmail.com',
      appPassword: 'dummy_app_password_9999'
    });
    assert.strictEqual(res.success, false);
    assert.ok(res.message.includes('Gmail Login Failed'), 'Must return formatted login failure');
    console.log('  ✔ Test 6: Live Gmail TLS handshake & invalid credential rejection verified');
  }

  console.log('All IMAP Error Handling Tests Passed!\n');
}

module.exports = runImapMockTests;

if (require.main === module) {
  runImapMockTests();
}
