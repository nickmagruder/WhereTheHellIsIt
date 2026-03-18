import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests only — integration tests use vitest.integration.config.ts with a real DB
    passWithNoTests: true,
    testTimeout: 10_000,
  },
});
