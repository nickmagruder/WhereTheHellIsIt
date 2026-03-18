// Root ESLint config. Covers all TypeScript files in the monorepo.
// root: true prevents ESLint from traversing further up the directory tree.
const base = require('./.eslintrc.base.js');

module.exports = {
  ...base,
  root: true,
  ignorePatterns: [
    'dist/**',
    '.next/**',
    '.expo/**',
    'cdk.out/**',
    'node_modules/**',
    '*.d.ts',
    'packages/graphql/src/generated/**',
    'coverage/**',
    '.turbo/**',
  ],
};
