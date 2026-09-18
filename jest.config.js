import nextJest from 'next/jest.js';

/** @type {import('jest').Config} */
const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Transform ES modules in node_modules (specifically jose)
  transformIgnorePatterns: ['node_modules/(?!(jose)/)'],
  // d3's modules publish ESM only, and next/jest's own transformIgnorePatterns keep
  // node_modules untransformed regardless of what is added above — so point jest at each
  // package's UMD build instead. Browser builds are unaffected; this is test-only.
  moduleNameMapper: {
    '^(d3-[a-z-]+)$': '<rootDir>/node_modules/$1/dist/$1.min.js',
    '^internmap$': '<rootDir>/node_modules/internmap/dist/internmap.min.js',
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config);
