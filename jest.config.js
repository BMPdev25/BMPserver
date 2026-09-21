module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  verbose: true,
  // server.js attaches a socket.io instance at import time which is not exported
  // (so it can't be closed in teardown). Without forceExit, Jest would hang open
  // after the run completes. DB/mongo teardown still runs in setup.js afterAll.
  forceExit: true,
  setupFilesAfterEnv: ['./tests/setup.js'],
  // Global — every test run uses the mock transport, so any registration
  // flow that triggers a welcome email never attempts a real SMTP connection
  // (which would hang/timeout against the fake EMAIL_HOST in .env.test).
  moduleNameMapper: {
    '^nodemailer$': '<rootDir>/tests/mocks/mailer.js',
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: ['node_modules/(?!(expo-server-sdk|axios)/)'],
  coveragePathIgnorePatterns: ['/node_modules/'],
  testPathIgnorePatterns: ['/node_modules/', '/.claude/worktrees/'],
};
