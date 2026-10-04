import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';

/**
 * Code style of this repository.
 *
 * Readability over brevity: every block gets braces and its own lines, one
 * statement per line, blank lines between class members and before returns.
 */
const style = {
  // Blocks are always written out, never `if (x) return;` on one line.
  'curly': ['error', 'all'],
  '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: false }],
  '@stylistic/max-statements-per-line': ['error', { max: 1 }],
  '@stylistic/multiline-ternary': ['error', 'always-multiline'],
  'no-nested-ternary': 'error',

  // Breathing room.
  '@stylistic/lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: false }],
  '@stylistic/padding-line-between-statements': [
    'error',
    { blankLine: 'always', prev: '*', next: 'return' },
    { blankLine: 'always', prev: ['const', 'let'], next: '*' },
    { blankLine: 'any', prev: ['const', 'let'], next: ['const', 'let'] },
    { blankLine: 'always', prev: 'block-like', next: '*' },
  ],
  '@stylistic/object-curly-newline': ['error', {
    ObjectExpression: { multiline: true, minProperties: 4, consistent: true },
    ObjectPattern: { multiline: true, consistent: true },
    ImportDeclaration: { multiline: true, minProperties: 4, consistent: true },
    ExportDeclaration: { multiline: true, minProperties: 4, consistent: true },
  }],
  '@stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: true }],
  '@stylistic/max-len': ['error', {
    code: 120,
    ignoreComments: false,
    ignoreStrings: true,
    ignoreTemplateLiterals: true,
    ignoreRegExpLiterals: true,
  }],

  // Formatting.
  '@stylistic/indent': ['error', 2, { SwitchCase: 1 }],
  '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
  '@stylistic/semi': ['error', 'always'],
  '@stylistic/comma-dangle': ['error', 'always-multiline'],
  '@stylistic/object-curly-spacing': ['error', 'always'],
  '@stylistic/array-bracket-spacing': ['error', 'never'],
  '@stylistic/arrow-parens': ['error', 'always'],
  '@stylistic/eol-last': ['error', 'always'],
  '@stylistic/no-trailing-spaces': 'error',
  '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],

  // Modern, explicit JavaScript.
  'no-var': 'error',
  'prefer-const': 'error',
  'prefer-template': 'error',
  'object-shorthand': ['error', 'always'],
  'eqeqeq': ['error', 'always', { null: 'ignore' }],
  'no-param-reassign': ['error', { props: false }],
  'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  'no-console': 'error',
};

export default [
  {
    ignores: [
      'node_modules/',
      '.homeybuild/',
      'coverage/',
    ],
  },
  js.configs.recommended,
  jsdoc.configs['flat/recommended'],
  {
    plugins: { '@stylistic': stylistic },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      ...style,
      'jsdoc/require-jsdoc': ['error', {
        publicOnly: true,
        require: { ClassDeclaration: true },
      }],
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-property-description': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/tag-lines': 'off',
      'jsdoc/no-undefined-types': 'off',
      'jsdoc/reject-any-type': 'off',
    },
  },
  {
    // Code that runs in the Homey web views (widget, settings page).
    files: ['widgets/*/public/**/*.js', 'settings/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
];
