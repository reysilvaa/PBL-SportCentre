module.exports = {
  env: {
    node: true,
    commonjs: true,
    es2021: true,
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 12,
  },
  globals: {
    module: 'writable',
    require: 'readonly',
    process: 'readonly',
    __dirname: 'readonly',
  },
};
