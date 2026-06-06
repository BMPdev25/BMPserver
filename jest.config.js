module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  verbose: true,
  // server.js attaches a socket.io instance at import time which is not exported
  // (so it can't be closed in teardown). Without forceExit, Jest would hang open
  // after the run completes. DB/mongo teardown still runs in setup.js afterAll.
  forceExit: true,
  setupFilesAfterEnv: ['./tests/setup.js'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: ['node_modules/(?!(expo-server-sdk|axios)/)'],
  coveragePathIgnorePatterns: ['/node_modules/'],
};
