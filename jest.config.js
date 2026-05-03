module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  verbose: true,
  setupFilesAfterEnv: ['./tests/setup.js'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: ['node_modules/(?!(expo-server-sdk|axios)/)'],
  coveragePathIgnorePatterns: ['/node_modules/'],
};
