import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const TS_FILES = ['**/*.ts', '**/*.mts'];
const JS_FILES = ['**/*.js', '**/*.mjs'];
const TEST_FILES = ['tests/**/*.ts', 'tests/**/*.mts'];
const SRC_TS_FILES = ['src/**/*.ts', 'src/**/*.mts'];

const RELATIVE_JS = '^\\.{1,2}/.*\\.m?js$';
const NOT_RELATIVE = '^(?!\\.{1,2}/)';

const SYNTAX_RULES = {
  curly: ['error', 'all'],
  'no-var': 'error',
  yoda: 'error',
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-fallthrough': 'error',
  'max-statements-per-line': ['error', { max: 1 }],
  'no-restricted-properties': [
    'error',
    { property: 'forEach', message: 'for...of を使う（規約 §5.1）' },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: 'Decorator',
      message: 'デコレータ構文は Node で実行できない（規約 §4.8）',
    },
    {
      selector: 'AccessorProperty',
      message: 'accessor フィールドは Node で実行できない（規約 §4.8）',
    },
    {
      selector:
        'CallExpression > MemberExpression:matches([property.name="then"], [property.value="then"])',
      message: '.then() チェーンではなく async / await を使う（規約 §5.3）',
    },
  ],
};

const RELATIVE_JS_IMPORT = {
  regex: RELATIVE_JS,
  message: '相対 import には実ファイルの拡張子を書く（規約 §2.2）',
};

const TS_RESTRICTED_SYNTAX = [
  ...SYNTAX_RULES['no-restricted-syntax'],
  {
    selector: `ImportExpression > Literal[value=/${RELATIVE_JS.replaceAll('/', '\\/')}/]`,
    message: RELATIVE_JS_IMPORT.message,
  },
  {
    selector: 'ImportExpression > :not(Literal).source',
    message:
      '動的 import の指定子は文字列リテラルで書く（規約 §2.2 の検査を効かせるため）',
  },
];

const UNUSED_VARS_OPTIONS = {
  args: 'all',
  argsIgnorePattern: '^_',
  varsIgnorePattern: '^_',
  caughtErrors: 'all',
  caughtErrorsIgnorePattern: '^_',
};

const EXTERNAL_MESSAGE =
  'src/ からは相対パス以外を import しない（docs/design.md）';

export default defineConfig(
  { ignores: ['dist/'] },

  { linterOptions: { reportUnusedDisableDirectives: 'error' } },

  {
    files: JS_FILES,
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.nodeBuiltin },
    rules: {
      ...SYNTAX_RULES,
      'no-unused-vars': ['error', UNUSED_VARS_OPTIONS],
    },
  },

  {
    files: TS_FILES,
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked],
    languageOptions: {
      globals: globals.nodeBuiltin,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...SYNTAX_RULES,
      'no-restricted-imports': ['error', { patterns: [RELATIVE_JS_IMPORT] }],
      'no-restricted-syntax': TS_RESTRICTED_SYNTAX,
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/explicit-module-boundary-types': [
        'error',
        {
          allowHigherOrderFunctions: false,
          allowDirectConstAssertionInArrowFunctions: false,
        },
      ],
      '@typescript-eslint/no-unused-vars': ['error', UNUSED_VARS_OPTIONS],
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          allowForKnownSafeCalls: [
            {
              from: 'package',
              package: 'node:test',
              name: ['describe', 'it', 'test', 'suite'],
            },
          ],
        },
      ],
    },
  },

  {
    files: SRC_TS_FILES,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            RELATIVE_JS_IMPORT,
            { regex: NOT_RELATIVE, message: EXTERNAL_MESSAGE },
          ],
        },
      ],
      'no-restricted-syntax': [
        ...TS_RESTRICTED_SYNTAX,
        {
          selector: `ImportExpression > Literal[value=/${NOT_RELATIVE.replaceAll('/', '\\/')}/]`,
          message: EXTERNAL_MESSAGE,
        },
      ],
    },
  },

  {
    files: TEST_FILES,
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },

  prettier,

  // eslint-config-prettier が curly と max-statements-per-line を無効にするため戻す（規約 §8.1「整形」）
  {
    files: [...TS_FILES, ...JS_FILES],
    rules: {
      curly: SYNTAX_RULES.curly,
      'max-statements-per-line': SYNTAX_RULES['max-statements-per-line'],
    },
  },
);
