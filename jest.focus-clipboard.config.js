module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/focusClipboard.test.ts', '**/tests/PasteFocusButton.test.tsx'],
  transform: { '^.+\\.tsx?$': 'babel-jest' },
};
