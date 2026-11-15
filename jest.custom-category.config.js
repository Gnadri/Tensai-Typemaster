module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  testMatch: ['**/tests/customCategory.test.tsx'],
  transform: { '^.+\\.tsx?$': 'babel-jest' },
};
