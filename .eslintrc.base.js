// Shared base ESLint config. Extended by per-package .eslintrc.js when packages
// need additional rules (e.g., React hooks, React Native). The root .eslintrc.js
// uses this directly and sets root: true to stop traversal.
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'jsx-a11y'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:jsx-a11y/recommended',
    'prettier',
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // Warn on explicit `any` — prefer unknown or proper types
    '@typescript-eslint/no-explicit-any': 'warn',
    // Note: @typescript-eslint/no-floating-promises requires parserOptions.project
    // (type-aware linting). Add it per-package when setting up type-aware lint in Phase 4+.
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
};
