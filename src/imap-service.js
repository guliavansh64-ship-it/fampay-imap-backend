'use strict';

const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const config = require('./config');
const { parseEmailContent, cleanHtml } = require('./parser');

/**
 * Creates an ImapFlow instance with strict timeouts and disabled logging for security
 */
function createImapClient(email, appPassword, options = {}) {
  const cleanEmail = (email || '').toLowerCase().trim();
  const cleanPassword = (appPassword || '').replace(/[\s\u00A0]+/g, '').toLowerCase().trim();

  const host = options.host || config.GMAIL_HOST;
  const port = options.port || config.GMAIL_PORT;
  const secure = options.secure !== undefined ? options.secure : config.GMAIL_SECURE;
  const timeout = options.timeoutMs || config.IMAP_TIMEOUT_MS;

  return new ImapFlow({
    host: host,
    port: port,
    secure: secure,
    auth: {
      user: cleanEmail,
      pass: cleanPassword
    },
    logger: false, // Prevent leaking passwords or mailbox headers into stdout
    connectionTimeout: timeout,
    greetingTimeout: timeout,
    socketTimeout: timeout
  });
}

/**
 * Executes a promise with an enforced timeout
 */
function withTimeout(promise, timeoutMs, errorMsg = 'Operation timed out') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(errorMsg);
      err.code = 'ETIMEDOUT';
      reject(err);
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Formats user-friendly error message from IMAP errors
 */
function formatImapError(err) {
  if (!err) return 'Unknown connection error';

  const msg = (err.message || '').toString();
  const respText = (err.responseText || '').toString();
  const code = err.code || '';
  const status = err.responseStatus || '';

  const fullErrStr = `${msg} ${respText} ${code} ${status}`;

  if (/application-specific password/i.test(fullErrStr)) {
    return 'Gmail Login Failed: You entered your standard Google account password. Google requires a 16-character App Password. Visit https://myaccount.google.com/apppasswords to generate one.';
  }

  if (/webloginrequired/i.test(fullErrStr)) {
    return 'Gmail Login Failed: Web login checkpoint required by Google. Visit https://accounts.google.com/DisplayUnlockCaptcha in your browser or enable IMAP in Gmail Settings.';
  }

  if (
    code === 'AuthenticationFailed' ||
    /invalid credentials|authentication/i.test(fullErrStr) ||
    (status === 'NO' && /failure|credentials|login/i.test(respText))
  ) {
    return 'Gmail Login Failed: Invalid Email or App Password. Ensure (1) 2-Step Verification is ON, (2) you generated a 16-character App Password at myaccount.google.com/apppasswords, and (3) IMAP is enabled in Gmail Settings.';
  }

  if (code === 'ETIMEDOUT' || /timed? ?out/i.test(fullErrStr)) {
    return 'Gmail IMAP connection timed out. Please check network connectivity and ensure imap.gmail.com:993 is reachable.';
  }

  if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || /dns|getaddrinfo/i.test(fullErrStr)) {
    return 'Unable to reach Gmail IMAP server (DNS or network error).';
  }

  return 'Gmail Login Failed: ' + (respText || msg || 'Unknown IMAP connection error');
}

/**
 * Tests connection and authentication to Gmail IMAP
 *
 * @param {object} params
 * @param {string} params.email - Gmail address
 * @param {string} params.appPassword - Google 16-digit App Password
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function testConnection({ email, appPassword, options = {} }) {
  if (!email || !appPassword) {
    return {
      success: false,
      message: 'Both Gmail email address and App Password are required.'
    };
  }

  const cleanEmail = (email || '').toLowerCase().trim();
  const cleanPassword = (appPassword || '').replace(/[\s\u00A0]+/g, '').toLowerCase().trim();

  // Support local development test sandbox if explicitly requested with test/sandbox credentials
  if (config.NODE_ENV === 'development' && (cleanPassword === 'sandbox' || cleanPassword === 'demo' || cleanEmail.endsWith('@test.local') || cleanEmail.endsWith('@sandbox.local'))) {
    return {
      success: true,
      message: 'Local Sandbox Gmail connection verified successfully!'
    };
  }

  const client = createImapClient(cleanEmail, cleanPassword, options);
  const timeout = options.timeoutMs || config.IMAP_TIMEOUT_MS;

  try {
    await withTimeout(client.connect(), timeout, 'IMAP connection timed out while establishing connection.');
    
    // Attempt to open INBOX to verify full mailbox read permission
    const lock = await withTimeout(client.getMailboxLock('INBOX'), timeout, 'IMAP connection timed out while opening INBOX.');
    lock.release();

    try {
      await client.logout();
    } catch (logoutErr) {
      // Ignore logout errors if connection was verified
    }

    return {
      success: true,
      message: 'Gmail connected successfully!'
    };
  } catch (err) {
    console.warn(`[IMAP testConnection failed for ${email}]: ${err.message || ''} | code: ${err.code || ''} | resp: ${err.responseText || ''}`);
    try {
      client.close();
    } catch (closeErr) {
      // Ignore cleanup error
    }
    return {
      success: false,
      message: formatImapError(err)
    };
  }
}

/**
 * Fetches recent FamPay transactions from Gmail IMAP
 *
 * @param {object} params
 * @param {string} params.email - Gmail address
 * @param {string} params.appPassword - Google App Password
 * @param {number} [params.days=2] - Search window in days
 * @param {number} [params.limit=30] - Max messages to inspect
 * @returns {Promise<{success: boolean, count: number, transactions: Array, message?: string}>}
 */
async function fetchRecentTransactions({ email, appPassword, days, limit, options = {} }) {
  if (!email || !appPassword) {
    return {
      success: false,
      count: 0,
      transactions: [],
      message: 'Both Gmail email address and App Password are required.'
    };
  }

  const searchDays = parseInt(days || config.DEFAULT_SEARCH_DAYS, 10);
  const fetchLimit = parseInt(limit || config.DEFAULT_FETCH_LIMIT, 10);
  const timeout = options.timeoutMs || (config.IMAP_TIMEOUT_MS * 2); // Allow extra time for message downloads

  const client = createImapClient(email, appPassword, options);
  const transactions = [];

  try {
    await withTimeout(client.connect(), config.IMAP_TIMEOUT_MS, 'Connection timed out during login.');

    const lock = await withTimeout(client.getMailboxLock('INBOX'), config.IMAP_TIMEOUT_MS, 'Timed out opening INBOX.');

    try {
      // Calculate since date
      const sinceDate = new Date(Date.now() - searchDays * 24 * 60 * 60 * 1000);

      // 1. Search for messages since date
      let uids = [];
      try {
        uids = await client.search({ since: sinceDate }, { uid: true });
      } catch (searchErr) {
        // Fallback to all if since fails
        uids = [];
      }

      // If no messages found with SINCE, search ALL
      if (!uids || uids.length === 0) {
        try {
          uids = await client.search({ all: true }, { uid: true });
        } catch (searchAllErr) {
          uids = [];
        }
      }

      if (!uids || uids.length === 0) {
        return {
          success: true,
          count: 0,
          transactions: []
        };
      }

      // Sort descending (newest UIDs first) and take limit
      uids.sort((a, b) => b - a);
      const selectedUids = uids.slice(0, fetchLimit);

      // Fetch envelopes and content
      for (const uid of selectedUids) {
        try {
          // Fetch envelope and body structure
          const msg = await client.fetchOne(uid, { envelope: true, bodyStructure: true, uid: true });
          if (!msg) continue;

          const envelope = msg.envelope || {};
          const subject = envelope.subject || '';
          let fromAddress = '';
          if (envelope.from && envelope.from.length > 0) {
            fromAddress = (envelope.from[0].address || '') + ' ' + (envelope.from[0].name || '');
          }

          // Relevance check: check from and subject keywords
          const checkStr = (fromAddress + ' ' + subject).toLowerCase();
          const isRelevant = checkStr.includes('famapp.in') ||
                             checkStr.includes('fampay') ||
                             checkStr.includes('fam') ||
                             checkStr.includes('paid') ||
                             checkStr.includes('received') ||
                             checkStr.includes('credited') ||
                             checkStr.includes('upi');

          if (!isRelevant) {
            continue;
          }

          // Fetch message source to parse body safely
          const rawMessage = await client.download(uid, undefined, { uid: true });
          if (!rawMessage || !rawMessage.content) continue;

          const parsed = await simpleParser(rawMessage.content);
          const bodyText = parsed.text || cleanHtml(parsed.html) || '';
          const fullText = subject + ' ' + bodyText;

          const parsedTxn = parseEmailContent(fullText);
          if (parsedTxn) {
            // Attach additional non-sensitive metadata for auditing
            parsedTxn.date = envelope.date ? envelope.date.toISOString() : new Date().toISOString();
            transactions.push(parsedTxn);
          }
        } catch (msgErr) {
          // Skip unparseable individual message and continue with others
          continue;
        }
      }
    } finally {
      lock.release();
    }

    try {
      await client.logout();
    } catch (logoutErr) {
      // Ignore
    }

    return {
      success: true,
      count: transactions.length,
      transactions: transactions
    };
  } catch (err) {
    try {
      client.close();
    } catch (closeErr) {
      // Ignore
    }

    return {
      success: false,
      count: 0,
      transactions: [],
      message: formatImapError(err)
    };
  }
}

module.exports = {
  createImapClient,
  testConnection,
  fetchRecentTransactions,
  formatImapError
};
