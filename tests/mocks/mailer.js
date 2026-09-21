/**
 * Mock implementation of nodemailer for testing mailService without a real
 * SMTP connection. Exposes the underlying sendMail jest.fn() so tests can
 * assert on calls (recipient, subject) without inspecting real emails.
 */
const sendMail = jest.fn().mockResolvedValue({ messageId: 'mock-message-id' });

module.exports = {
  createTransport: jest.fn(() => ({ sendMail })),
  __sendMail: sendMail,
};
