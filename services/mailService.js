// services/mailService.js
const nodemailer = require('nodemailer');

let transporter;

// Lazily build the transporter so tests can set EMAIL_* env vars before the
// first send, and so a misconfigured/missing SMTP setup never crashes
// registration — it just skips the email.
function getTransporter() {
  if (transporter !== undefined) return transporter;

  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
    transporter = null;
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: Number(EMAIL_PORT) || 587,
    secure: Number(EMAIL_PORT) === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });
  return transporter;
}

/**
 * Sends an email. Never throws — email delivery must never block or fail
 * the auth flow it's attached to. Returns { sent, skipped, error }.
 */
async function sendMail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    console.warn(`[Mail] Email not configured — skipping "${subject}" to ${to}`);
    return { sent: false, skipped: true };
  }

  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      html,
    });
    return { sent: true };
  } catch (error) {
    console.error(`[Mail] Failed to send "${subject}" to ${to}:`, error.message);
    return { sent: false, error: error.message };
  }
}

function welcomeEmailHtml(name, userType) {
  const roleLabel = userType === 'priest' ? 'Pandit' : 'Devotee';
  const roleMessage =
    userType === 'priest'
      ? 'Complete your onboarding and verification to start receiving booking requests from devotees near you.'
      : 'Start exploring verified pandits and book your first ceremony in just a few taps.';

  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#B45309;margin-bottom:8px">Welcome to BookMyPujari, ${name}! 🙏</h2>
      <p>Thank you for joining BookMyPujari as a ${roleLabel}.</p>
      <p>${roleMessage}</p>
      <p style="margin-top:24px;color:#6b7280;font-size:13px">
        If you didn't create this account, please ignore this email.
      </p>
    </div>
  `;
}

/**
 * Sends the "Welcome to BookMyPujari" email on first registration.
 * Silently skipped when the user has no email (e.g. OTP-only phone signup).
 */
async function sendWelcomeEmail(user) {
  if (!user || !user.email) {
    return { sent: false, skipped: true, reason: 'no-email' };
  }
  return sendMail({
    to: user.email,
    subject: 'Welcome to BookMyPujari 🙏',
    html: welcomeEmailHtml(user.name || 'there', user.userType),
  });
}

module.exports = { sendMail, sendWelcomeEmail };
