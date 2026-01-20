import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.config.*'],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  // CLI package exception - console output is expected
  {
    files: ['mcp-ui-cli/src/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  // Logger utility - console output is expected
  {
    files: ['mcp-ui-solid/src/utils/logger.ts'],
    rules: { 'no-console': 'off' },
  }
);
