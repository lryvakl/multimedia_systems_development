import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'samples/', 'dist/'] },
  js.configs.recommended,
  {
    files: ['src/renderer/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/shared/**/*.js'],
    languageOptions: { globals: { URL: 'readonly' } },
  },
  {
    files: ['src/main/**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  {
    files: ['tests/**/*.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: 'error',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
];
