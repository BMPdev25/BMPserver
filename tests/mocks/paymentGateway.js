/**
 * Mock implementation of Razorpay for integration testing.
 * Simulates external API calls and webhook triggers.
 */
module.exports = {
    orders: {
        create: jest.fn().mockResolvedValue({
            id: 'order_mock_123',
            amount: 50000,
            currency: 'INR',
            status: 'created'
        })
    },
    payments: {
        fetch: jest.fn().mockResolvedValue({
            id: 'pay_mock_123',
            status: 'captured',
            amount: 50000
        }),
        refund: jest.fn().mockResolvedValue({
            id: 'rfnd_mock_123',
            status: 'processed'
        })
    },
    // Mock for verifying webhook signature
    validateWebhookSignature: jest.fn().mockReturnValue(true)
};
