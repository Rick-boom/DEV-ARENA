/**
 * Node service config: base rules + Node globals.
 * Console is allowed because services log through a logger that
 * ultimately writes to stdout (12-factor).
 */
import globals from 'globals';
import base from './base.js';

export default [
  ...base,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
    },
  },
];
