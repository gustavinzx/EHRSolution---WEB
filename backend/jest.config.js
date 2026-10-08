module.exports = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/tests/globalSetup.js',
  setupFiles: ['<rootDir>/tests/envSetup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js']
};
