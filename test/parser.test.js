'use strict';

const assert = require('assert');
const { parseEmailContent, cleanHtml } = require('../src/parser');

function runParserTests() {
  console.log('--- Running Parser Tests ---');

  // Test 1: Standard FamPay email format
  {
    const emailText = `
      Hey Pritam Bepari, You have successfully paid ₹1.00
      Transaction ID : FMPU01a0d9ad-1726-7792-b41b-85baf06c9f67
      UTR : 663493224330
      Purpose : ORD202609251C8992
    `;
    const res = parseEmailContent(emailText);
    assert.ok(res, 'Should parse standard email');
    assert.strictEqual(res.amount, 1.0);
    assert.strictEqual(res.utr, '663493224330');
    assert.strictEqual(res.fam_txn_id, 'FMPU01a0d9ad-1726-7792-b41b-85baf06c9f67');
    assert.strictEqual(res.purpose, 'ORD202609251C8992');
    console.log('  ✔ Test 1: Standard FamPay email parsed successfully');
  }

  // Test 2: Rs. and comma formatted amounts
  {
    const emailText = `
      Payment from famapp: Rs. 1,500.50 credited to your account.
      UTR : 412345678901
      Purpose : ORDER_998877
      Transaction ID : FMPU9999
    `;
    const res = parseEmailContent(emailText);
    assert.ok(res, 'Should parse comma amounts');
    assert.strictEqual(res.amount, 1500.50);
    assert.strictEqual(res.utr, '412345678901');
    assert.strictEqual(res.purpose, 'ORDER_998877');
    console.log('  ✔ Test 2: Comma and Rs. amounts parsed successfully');
  }

  // Test 3: INR and space formatting
  {
    const emailText = `
      Money added to wallet. INR 50.00 received.
      Ref Number 555666777888
      Transaction ID : FMPU_TEST_123
    `;
    const res = parseEmailContent(emailText);
    assert.ok(res, 'Should parse INR amounts and Ref Number');
    assert.strictEqual(res.amount, 50.0);
    assert.strictEqual(res.utr, '555666777888');
    assert.strictEqual(res.fam_txn_id, 'FMPU_TEST_123');
    console.log('  ✔ Test 3: INR format and alternative UTR label parsed');
  }

  // Test 4: FamPay email without UTR (falls back to fam_txn_id)
  {
    const emailText = `
      Hey user, You have successfully paid ₹250.00 to merchant.
      Transaction ID : FMPU_NO_UTR_9999
      Purpose : ORD_TEST_NO_UTR
    `;
    const res = parseEmailContent(emailText);
    assert.ok(res, 'Should parse transaction even without UTR');
    assert.strictEqual(res.amount, 250.0);
    assert.strictEqual(res.utr, 'FMPU_NO_UTR_9999');
    assert.strictEqual(res.fam_txn_id, 'FMPU_NO_UTR_9999');
    assert.strictEqual(res.purpose, 'ORD_TEST_NO_UTR');
    console.log('  ✔ Test 4: UTR fallback to Transaction ID verified');
  }

  // Test 5: HTML email cleaning and entity decoding
  {
    const htmlEmail = `
      <html>
        <body>
          <div style="color:red;">FamPay Alert</div>
          <p>You have successfully paid &#8377;99.99&nbsp;via UPI</p>
          <p>UTR : 123456789012</p>
          <p>Purpose : ORD_HTML_TEST</p>
        </body>
      </html>
    `;
    const cleaned = cleanHtml(htmlEmail);
    assert.ok(!cleaned.includes('<p>'), 'HTML tags must be stripped');
    assert.ok(cleaned.includes('₹99.99'), 'HTML entities must be decoded');
    const res = parseEmailContent(cleaned);
    assert.ok(res, 'Should parse cleaned HTML text');
    assert.strictEqual(res.amount, 99.99);
    assert.strictEqual(res.utr, '123456789012');
    assert.strictEqual(res.purpose, 'ORD_HTML_TEST');
    console.log('  ✔ Test 5: HTML cleaning and entity decoding verified');
  }

  // Test 6: Irrelevant non-payment email
  {
    const emailText = `
      Your FamApp statement for September is now available for download.
      Please log in to your account to view your balance.
    `;
    const res = parseEmailContent(emailText);
    assert.strictEqual(res, null, 'Non-payment email must return null');
    console.log('  ✔ Test 6: Non-payment emails correctly rejected');
  }

  // Test 7: Empty or invalid input
  {
    assert.strictEqual(parseEmailContent(''), null);
    assert.strictEqual(parseEmailContent(null), null);
    assert.strictEqual(parseEmailContent(undefined), null);
    assert.strictEqual(parseEmailContent('Random text with no keywords'), null);
    console.log('  ✔ Test 7: Empty and malformed inputs safely handled');
  }

  console.log('All Parser Tests Passed!\n');
}

module.exports = runParserTests;

if (require.main === module) {
  runParserTests();
}
