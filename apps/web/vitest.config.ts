import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // environment: 'jsdom' — add jsdom devDep when writing component tests in Phase 5
    passWithNoTests: true,
  },
});
