import globals from 'globals';

/* catches names used without being defined or imported, the main risk now the app is split into modules */
export default [
  { ignores: ['dist/', 'node_modules/', 'test-results/', 'playwright-report/'] },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.browser, ...globals.node } },
    rules: { 'no-undef': 'error', 'no-redeclare': 'error', 'no-dupe-keys': 'error', 'no-unreachable': 'error', 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }] }
  }
];
