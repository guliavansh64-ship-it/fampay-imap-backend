'use strict';

/**
 * FamPay Email Parser
 * Safely extracts payment amount, UTR, FamPay Transaction ID, and Purpose (Order ID).
 * Matches the logic in FamPayGmailAPI.php with improved HTML entity decoding and sanitization.
 */

/**
 * Strips HTML tags and decodes basic HTML entities
 */
function cleanHtml(html) {
  if (!html || typeof html !== 'string') return '';

  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#8377;/g, '₹')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses raw text or decoded email body for FamPay credit details
 *
 * Supported formats include:
 *   Hey Pritam Bepari, You have successfully paid ₹1.00
 *   Transaction ID : FMPU01a0d9ad-1726-7792-b41b-85baf06c9f67
 *   UTR : 663493224330
 *   Purpose : ORD202609251C8992
 *
 * @param {string} text - Raw or cleaned email body text
 * @returns {object|null} Parsed transaction object or null if not a matching transaction email
 */
function parseEmailContent(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const cleanText = text.replace(/\s+/g, ' ').trim();

  // 1. Check if email indicates credit or payment
  const isFamPay = /(successfully\s*paid|received|credited|added|paid\s*you|money\s*added|payment\s*from|famapp|fampay)/i.test(cleanText);
  if (!isFamPay) {
    return null;
  }

  // 2. Extract Amount: supports ₹1.00, ₹ 1.00, Rs. 1.00, INR 1.00
  let amount = 0.0;
  let amtMatches;

  if ((amtMatches = cleanText.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i))) {
    amount = parseFloat(amtMatches[1].replace(/,/g, ''));
  } else if ((amtMatches = cleanText.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:Rs\.?|INR|₹)/i))) {
    amount = parseFloat(amtMatches[1].replace(/,/g, ''));
  } else if ((amtMatches = cleanText.match(/(?:successfully\s*paid|paid|amount)\s*[:\s]*[^\d]*([\d,]+(?:\.\d{1,2})?)/i))) {
    amount = parseFloat(amtMatches[1].replace(/,/g, ''));
  }

  // 3. Extract UTR / Bank Reference (12 digits)
  let utr = '';
  let utrMatches;

  if ((utrMatches = cleanText.match(/UTR\s*[:\-]?\s*(\d{12})/i))) {
    utr = utrMatches[1];
  } else if ((utrMatches = cleanText.match(/(?:Ref(?:erence)?\s*(?:No|Num|Number|ID)?|UPI\s*Ref)[^\d]{0,10}(\d{12})/i))) {
    utr = utrMatches[1];
  } else if ((utrMatches = cleanText.match(/\b(4\d{11}|5\d{11}|6\d{11}|7\d{11}|8\d{11}|9\d{11}|\d{12})\b/))) {
    utr = utrMatches[1];
  }

  // 4. Extract FamPay Transaction ID (e.g. FMPU01a0d9ad-1726-7792-b41b-85baf06c9f67)
  let famTxnId = '';
  const txnMatches = cleanText.match(/Transaction\s*ID\s*[:\-]?\s*([A-Za-z0-9\-_]+)/i);
  if (txnMatches) {
    famTxnId = txnMatches[1].trim();
  }

  // 5. Extract Purpose / Order ID (e.g. ORD202609251C8992)
  let purpose = '';
  const purposeMatches = cleanText.match(/Purpose\s*[:\-]?\s*([A-Za-z0-9_]+)/i);
  if (purposeMatches) {
    purpose = purposeMatches[1].trim();
  }

  if (amount > 0) {
    return {
      amount: amount,
      utr: utr || (famTxnId || ''),
      fam_txn_id: famTxnId,
      purpose: purpose,
      raw: cleanText.substring(0, 300)
    };
  }

  return null;
}

module.exports = {
  cleanHtml,
  parseEmailContent
};
