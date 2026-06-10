// services/smsService.js
const axios = require('axios');

async function sendOtp(phone, otp) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SMS DEV] OTP for ${phone}: ${otp}`);
    return { success: true, dev: true };
  }

  const apiKey = process.env.MSG91_API_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!apiKey || !templateId) {
    console.error('[SMS] MSG91_API_KEY or MSG91_TEMPLATE_ID not set');
    throw new Error('SMS service is not configured. Please contact support.');
  }

  try {
    const response = await axios.post(
      'https://api.msg91.com/api/v5/otp',
      {
        template_id: templateId,
        mobile: phone.replace('+', ''),
        authkey: apiKey,
        otp: otp,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );
    return { success: true, data: response.data };
  } catch (err) {
    console.error('[SMS] Failed to send OTP:', err.message);
    throw new Error('Failed to send OTP. Please check your phone number and try again.', {
      cause: err,
    });
  }
}

module.exports = { sendOtp };
