const shared = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.\\./)+modules/audio-engine$': '<rootDir>/tests/mocks/audio-engine.ts',
  },
};

module.exports = {
  projects: [
    { ...shared, displayName: 'unit', testMatch: ['<rootDir>/tests/unit/**/*.test.ts'] },
    { ...shared, displayName: 'integration', testMatch: ['<rootDir>/tests/integration/**/*.test.{ts,tsx}'] },
  ],
  clearMocks: true,
  maxWorkers: 2,
  collectCoverageFrom: [
    'src/lib/chords.ts',
    'src/lib/notes.ts',
    'src/model/defaults.ts',
    'src/model/soundCategories.ts',
    'src/store/concert.ts',
    'src/store/storage.ts',
    'src/engine/pads.ts',
    'src/engine/controls.ts',
    'src/engine/sync.ts',
    'src/engine/diagnostics.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: { branches: 65, functions: 75, lines: 80, statements: 80 },
  },
};
