const shared = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.\\./)+modules/audio-engine$': '<rootDir>/tests/mocks/audio-engine.tsx',
  },
};

module.exports = {
  projects: [
    { ...shared, displayName: 'unit', testMatch: ['<rootDir>/tests/unit/**/*.test.ts'] },
    { ...shared, displayName: 'integration', testMatch: ['<rootDir>/tests/integration/**/*.test.{ts,tsx}'] },
  ],
  clearMocks: true,
  maxWorkers: 2,
  // Everything is measured by default, so a new file cannot silently escape the thresholds.
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  // Ratchet: each layer stays just under its measured coverage. Raise these when coverage improves, never lower them.
  coverageThreshold: {
    global: { branches: 80, functions: 85, lines: 90, statements: 90 },
    './src/lib/': { branches: 80, functions: 85, lines: 90, statements: 90 },
    './src/model/': { branches: 80, functions: 85, lines: 90, statements: 90 },
    './src/store/': { branches: 80, functions: 85, lines: 90, statements: 90 },
    './src/engine/': { branches: 80, functions: 85, lines: 90, statements: 90 },
    './src/components/': { branches: 80, functions: 84, lines: 90, statements: 88 },
    './src/app/': { branches: 82, functions: 85, lines: 88, statements: 88 },
  },
};
