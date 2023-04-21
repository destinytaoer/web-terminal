module.exports = {
  extends: [
    'plugin:import/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  plugins: ['react', '@typescript-eslint'],
  env: {
    browser: true,
    es6: true,
  },
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      legacyDecorators: true,
      jsx: true,
    },
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    'linebreak-style': 'off',
    'prettier/prettier': [
      'error',
      {
        endOfLine: 'auto',
      },
    ],
    'import/extensions': [
      'error',
      'never',
      {ignorePackages: true}
    ],
    'import/no-unresolved': 'error',
    '@typescript-eslint/no-shadow': 0,
    'import/no-extraneous-dependencies': 0,
    'import/named': 0,
    '@typescript-eslint/naming-convention': 0
  },
  'settings': {
    'import/parsers': {
      // 使用 TypeScript parser
      '@typescript-eslint/parser': ['.ts', '.tsx', '.js', '.jsx']
    },
  }
};
