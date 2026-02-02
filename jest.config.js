module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  verbose: true,
  setupFilesAfterEnv: ['./tests/setup.js'],
  coveragePathIgnorePatterns: [
    "/node_modules/"
  ]
};
