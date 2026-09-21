process.env.NODE_ENV = 'test'

// nodemailer is globally mocked via jest.config.js moduleNameMapper.
const nodemailerMock = require('nodemailer')

describe('mailService', () => {
  // Required once — mailService caches its transporter on first use, and
  // resetting modules per-test would swap in a fresh nodemailer mock that
  // this describe block's `nodemailerMock` reference no longer points to.
  const mailService = require('../services/mailService')

  beforeEach(() => {
    nodemailerMock.__sendMail.mockClear()
    nodemailerMock.createTransport.mockClear()
  })

  describe('sendWelcomeEmail', () => {
    it('sends a welcome email to a devotee with the right recipient and subject', async () => {
      const result = await mailService.sendWelcomeEmail({
        name: 'Asha',
        email: 'asha@example.com',
        userType: 'devotee',
      })

      expect(result.sent).toBe(true)
      expect(nodemailerMock.__sendMail).toHaveBeenCalledTimes(1)
      const call = nodemailerMock.__sendMail.mock.calls[0][0]
      expect(call.to).toBe('asha@example.com')
      expect(call.subject).toMatch(/Welcome to BookMyPujari/)
      expect(call.html).toContain('Asha')
      expect(call.html).toContain('Devotee')
    })

    it('sends a welcome email to a priest with priest-specific messaging', async () => {
      const result = await mailService.sendWelcomeEmail({
        name: 'Sharma Ji',
        email: 'sharma@example.com',
        userType: 'priest',
      })

      expect(result.sent).toBe(true)
      const call = nodemailerMock.__sendMail.mock.calls[0][0]
      expect(call.to).toBe('sharma@example.com')
      expect(call.html).toContain('Pandit')
      expect(call.html).toContain('verification')
    })

    it('skips silently when the user has no email (phone-only signup)', async () => {
      const result = await mailService.sendWelcomeEmail({
        name: 'Ravi',
        userType: 'devotee',
      })

      expect(result.sent).toBe(false)
      expect(result.skipped).toBe(true)
      expect(nodemailerMock.__sendMail).not.toHaveBeenCalled()
    })

    it('never throws when the underlying send fails', async () => {
      nodemailerMock.__sendMail.mockRejectedValueOnce(new Error('SMTP down'))

      await expect(
        mailService.sendWelcomeEmail({ name: 'Meera', email: 'meera@example.com', userType: 'devotee' })
      ).resolves.toEqual(expect.objectContaining({ sent: false }))
    })
  })

  describe('when email is not configured', () => {
    const ORIGINAL_ENV = { ...process.env }

    afterEach(() => {
      process.env = { ...ORIGINAL_ENV }
    })

    it('skips sending instead of throwing when EMAIL_* vars are missing', async () => {
      jest.resetModules()
      delete process.env.EMAIL_HOST
      delete process.env.EMAIL_USER
      delete process.env.EMAIL_PASS
      const freshMailService = require('../services/mailService')

      const result = await freshMailService.sendWelcomeEmail({
        name: 'Kiran',
        email: 'kiran@example.com',
        userType: 'devotee',
      })

      expect(result.sent).toBe(false)
      expect(result.skipped).toBe(true)
    })
  })
})
