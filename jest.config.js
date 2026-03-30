module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/db/migrations/**',
    '!server/db/seeds/**',
    '!server/index.js',
    '!server/config/env.js',
  ],
  setupFiles: ['./tests/setup.js'],
  testTimeout: 30000,
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
};
