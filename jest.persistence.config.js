module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/durableStore.test.ts', '**/tests/leaderboardRepository.test.ts', '**/tests/desktopLeaderboardStorage.test.ts', '**/tests/roundTimer.test.ts'],
  transform: { '^.+\\.tsx?$': 'babel-jest' },
};
