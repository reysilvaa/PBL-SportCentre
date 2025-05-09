import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import unusedImports from 'eslint-plugin-unused-imports';
import { config } from './src/config/app/env';

// Menentukan environment: development atau production
// Menggunakan konfigurasi dari env.ts
const _isDevelopment = !config.isProduction;

// Flag untuk mengaktifkan mode fix-all
// Jika process.env.ESLINT_FIX_ALL === 'true', maka semua aturan yang biasanya 
// hanya warning akan dimatikan (off)
const isFixAll = process.env.ESLINT_FIX_ALL === 'true';

export default [
  {
    ignores: ['node_modules/', 'dist/'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        console: 'readonly',
        global: 'writable',
        Buffer: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        module: 'readonly',
        require: 'readonly',
        NodeJS: 'readonly',
        Express: 'readonly',
        document: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'unused-imports': unusedImports,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'off',
      'unused-imports/no-unused-vars': 'off',
      'no-console': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      'no-case-declarations': 'off',
      '@typescript-eslint/naming-convention': 'off',
      'eqeqeq': 'off',
      'no-var': 'off',
      'prefer-const': 'off',
      'no-multiple-empty-lines': 'off',
      'comma-dangle': 'off',
      'semi': 'off',
      'quotes': 'off',
      'no-undef': 'off',
    },
  },
];
