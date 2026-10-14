'use strict';

const runParserTests = require('./parser.test');
const runAuthTests = require('./auth.test');
const runApiTests = require('./api.test');
const runImapMockTests = require('./imap-mock.test');

async function main() {
  console.log('====================================================');
  console.log(' FATAFATPAY FAMPAY IMAP BACKEND — AUTOMATED TEST SUITE');
  console.log('====================================================\n');

  try {
    runParserTests();
    runAuthTests();
    await runImapMockTests();
    await runApiTests();

    console.log('====================================================');
    console.log(' ALL TESTS PASSED SUCCESSFULLY! (100% Pass Rate)');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exit(1);
  }
}

main();
