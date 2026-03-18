import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests only — integration tests use a separate config with a real PostgreSQL connection
    passWithNoTests: true,
    testTimeout: 10_000,
  },
});
