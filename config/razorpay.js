// config/razorpay.js
// Razorpay configuration with sandbox/live toggle
// When RAZORPAY_LIVE=true and credentials are set, real API calls are made.
// Otherwise, all payouts auto-succeed (sandbox mode).

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_LIVE = process.env.RAZORPAY_LIVE === 'true';

/**
 * Returns true if real Razorpay credentials are configured and live mode is on.
 */
function isLive() {
  return RAZORPAY_LIVE && !!RAZORPAY_KEY_ID && !!RAZORPAY_KEY_SECRET;
}

/**
 * Mock bank transfer – always succeeds.
 * Returns a fake payout reference ID.
 */
async function mockBankTransfer(priestBankDetails, amount) {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 200));
  const fakeId = `mock_payout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  console.log(`[SANDBOX] Mock payout of ₹${amount} → ${fakeId}`);
  return {
    success: true,
    referenceId: fakeId,
    status: 'completed',
  };
}

/**
 * Real Razorpay Payout via Razorpay Payout API (RazorpayX).
 * Requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.
 *
 * priestBankDetails: { accountNumber, ifsc, name }
 * amount: Number in INR (will be converted to paise)
 */
// The standard razorpay npm SDK only covers the Payment Gateway (Orders/Payments/Refunds).
// RazorpayX Payout APIs (contacts, fundAccounts, payouts) must be called directly via HTTP.
async function razorpayXPost(path, body) {
  const https = require('https');
  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.razorpay.com',
        path,
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) reject(new Error(parsed.error?.description || `RazorpayX error ${res.statusCode}`));
          else resolve(parsed);
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function razorpayBankTransfer(priestBankDetails, amount) {
  // Step 1: Create a Contact (priest)
  const contact = await razorpayXPost('/v1/contacts', {
    name: priestBankDetails.name,
    type: 'vendor',
  });

  // Step 2: Create a Fund Account
  const fundAccount = await razorpayXPost('/v1/fund_accounts', {
    contact_id: contact.id,
    account_type: 'bank_account',
    bank_account: {
      name: priestBankDetails.name,
      ifsc: priestBankDetails.ifsc,
      account_number: priestBankDetails.accountNumber,
    },
  });

  // Step 3: Create a Payout
  const payout = await razorpayXPost('/v1/payouts', {
    account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
    fund_account_id: fundAccount.id,
    amount: Math.round(amount * 100), // paise
    currency: 'INR',
    mode: 'IMPS',
    purpose: 'payout',
    queue_if_low_balance: true,
  });

  return {
    success: true,
    referenceId: payout.id,
    status: payout.status,
  };
}

/**
 * Initiate a bank transfer to a priest.
 * Automatically picks live Razorpay or sandbox mock based on config.
 *
 * @param {Object} priestBankDetails - { accountNumber, ifsc, name }
 * @param {Number} amount - amount in INR
 * @returns {{ success: boolean, referenceId: string, status: string }}
 */
async function initiateBankTransfer(priestBankDetails, amount) {
  if (isLive()) {
    console.log(`[LIVE] Initiating Razorpay payout of ₹${amount}`);
    return razorpayBankTransfer(priestBankDetails, amount);
  } else {
    console.log(`[SANDBOX] Razorpay not configured or not live. Using mock.`);
    return mockBankTransfer(priestBankDetails, amount);
  }
}

module.exports = {
  initiateBankTransfer,
  isLive,
};
