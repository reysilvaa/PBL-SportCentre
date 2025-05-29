import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import unusedImports from 'eslint-plugin-unused-imports';
import { config } from './src/config/app/env';

const _isDevelopment = !config.isProduction;
const isFixAll = process.env.ESLINT_FIX_ALL === 'true';

export default [
  {
    ignores: ['node_modules/', 'dist/' ],
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
      // Turn off base rules that conflict with unused-imports
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',

      // Enable auto-remove unused imports
      'unused-imports/no-unused-imports': 'error',

      // Auto-remove unused vars (vars prefixed with "_" are ignored)
      'unused-imports/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],

      // Optional: turn off more rules in "fix-all" mode
      ...(isFixAll && {
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
      }),
    },
  },
];
