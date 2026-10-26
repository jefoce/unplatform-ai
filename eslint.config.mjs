import stylistic from '@stylistic/eslint-plugin'
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'
import betterTailwind from 'eslint-plugin-better-tailwindcss'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import sonarjs from 'eslint-plugin-sonarjs'
import unicorn from 'eslint-plugin-unicorn'
import tseslint from 'typescript-eslint'

import callbackProps from './eslint-rules/callback-props.mjs'
import inlineHookCallbacks from './eslint-rules/inline-hook-callbacks.mjs'
import paddingAroundFunctions from './eslint-rules/padding-around-functions.mjs'
import {
  INLINE_FUNCTION_SELECTORS,
  MODULE_SELECTORS,
  OBJECT_FUNCTION_SELECTOR,
  PROPS_SELECTOR,
  SECRET_SELECTORS,
  SERVER_SELECTORS,
  SHARED_SELECTORS,
  TYPE_SELECTORS,
  UNION_SELECTORS,
  restrict,
} from './eslint-rules/selectors.mjs'

const localPlugin = {
  rules: {
    'callback-props': callbackProps,
    'inline-hook-callbacks': inlineHookCallbacks,
    'padding-around-functions': paddingAroundFunctions,
  },
}

export default defineConfig([
  ...nextVitals,
  ...nextTs,

  // Every TS file in the app and tests
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    plugins: {
      '@stylistic': stylistic,
      'simple-import-sort': simpleImportSort,
      sonarjs,
      unicorn,
      'better-tailwindcss': betterTailwind,
    },
    settings: {
      'better-tailwindcss': {
        entryPoint: 'src/app/globals.css',
        callees: ['cn', 'clsx'],
        variables: [['_CLASSES$', [{ match: 'strings' }]]],
      },
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Imports
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^\\u0000'],
            ['^node:'],
            ['^react$', '^react-dom', '^next', '^@?\\w'],
            ['^@/'],
            ['^\\.\\.', '^\\.'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-duplicates': ['error', { 'prefer-inline': true }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'lodash', message: 'Use lodash-es named imports.' },
            {
              name: 'next/image',
              message: 'Posters and thumbs use <img>. See AGENTS.md.',
            },
          ],
          patterns: [
            {
              group: ['@tauri-apps/*'],
              message: 'Only src/lib/platform/desktop.ts imports Tauri.',
            },
          ],
        },
      ],

      // Layers and cycles live in .dependency-cruiser.cjs

      // TypeScript
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-confusing-void-expression': 'error',
      '@typescript-eslint/max-params': ['error', { max: 2 }],
      '@typescript-eslint/no-deprecated': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        { allowString: false, allowNumber: false, allowNullableObject: true },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variable',
          types: ['boolean'],
          format: ['PascalCase'],
          prefix: ['is', 'has', 'can', 'should', 'did'],
        },
        {
          selector: 'parameter',
          types: ['boolean'],
          format: ['PascalCase'],
          prefix: ['is', 'has', 'can', 'should', 'did'],
        },
        { selector: 'typeLike', format: ['PascalCase'] },
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['PascalCase'],
          filter: { regex: '^[A-Z][a-z]', match: true },
        },
        {
          selector: 'variable',
          modifiers: ['const', 'global'],
          format: ['UPPER_CASE', 'camelCase'],
          filter: { regex: '^(?![A-Z][a-z])(?!.*Schema$)', match: true },
        },
      ],

      // Plain JS
      eqeqeq: ['error', 'always'],
      'no-nested-ternary': 'error',
      'no-implicit-coercion': 'error',
      'no-else-return': ['error', { allowElseIf: false }],
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'no-param-reassign': 'error',
      'no-promise-executor-return': 'error',

      // Size and nesting
      'max-depth': ['error', 3],
      'max-nested-callbacks': ['error', 3],
      complexity: ['error', 10],
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],
      'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],

      // React
      'react/function-component-definition': [
        'error',
        {
          namedComponents: 'function-declaration',
          unnamedComponents: 'arrow-function',
        },
      ],
      'react/jsx-no-useless-fragment': ['error', { allowExpressions: true }],
      'react/self-closing-comp': 'error',
      'react/jsx-boolean-value': 'error',
      'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never' }],
      'react/no-array-index-key': 'warn',
      // Inline JSX functions are banned per layer by INLINE_FUNCTION_SELECTORS.
      'react/jsx-no-bind': 'off',
      'react/no-multi-comp': ['error', { ignoreStateless: false }],
      'react/jsx-max-depth': ['error', { max: 6 }],
      'react/hook-use-state': 'error',
      'react-hooks/exhaustive-deps': 'error',

      // Project rules from AGENTS.md live in the per-layer blocks below.

      // Unicorn, selected rules only
      'unicorn/consistent-function-scoping': 'error',
      'unicorn/no-lonely-if': 'error',
      'unicorn/no-negated-condition': 'error',
      'unicorn/no-useless-undefined': 'error',
      'unicorn/no-for-each': 'error',
      'unicorn/no-for-loop': 'error',
      'unicorn/prefer-array-find': 'error',
      'unicorn/prefer-array-some': 'error',
      'unicorn/prefer-array-flat-map': 'error',
      'unicorn/prefer-at': 'error',
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/prefer-string-replace-all': 'error',
      'unicorn/throw-new-error': 'error',
      'unicorn/error-message': 'error',
      'unicorn/no-abusive-eslint-disable': 'error',
      'unicorn/filename-case': ['error', { cases: { kebabCase: true, pascalCase: true } }],

      // SonarJS
      'sonarjs/cognitive-complexity': ['error', 12],
      'sonarjs/no-identical-functions': 'error',

      // Tailwind
      'better-tailwindcss/no-unknown-classes': ['error', { detectComponentClasses: true }],
      'better-tailwindcss/no-conflicting-classes': 'error',
      'better-tailwindcss/no-duplicate-classes': 'error',
      'better-tailwindcss/no-deprecated-classes': 'error',
      'better-tailwindcss/enforce-shorthand-classes': 'error',
      'better-tailwindcss/enforce-canonical-classes': 'error',
      'better-tailwindcss/no-unnecessary-whitespace': 'error',
      'better-tailwindcss/no-restricted-classes': [
        'error',
        {
          restrict: [
            {
              pattern: '\\[#[0-9a-fA-F]{3,8}\\]',
              message: 'Use a color token from @theme.',
            },
            {
              pattern: '\\[(rgb|rgba|hsl|hsla)\\(',
              message: 'Use a color token from @theme.',
            },
            {
              pattern:
                '^(m|mx|my|mt|mr|mb|ml|p|px|py|pt|pr|pb|pl|gap|gap-x|gap-y|w|h|size|min-w|max-w|min-h|max-h|top|right|bottom|left|inset|inset-x|inset-y|translate-x|translate-y|text|rounded|rounded-[trbl]{1,2}|backdrop-blur)-\\[\\d+(\\.\\d+)?px\\]$',
              message: 'Use the Tailwind scale or a @theme token.',
            },
          ],
        },
      ],
      // Prettier's Tailwind plugin owns class order and wrapping
      'better-tailwindcss/enforce-consistent-class-order': 'off',
      'better-tailwindcss/enforce-consistent-line-wrapping': 'off',
    },
  },

  // Project rules compose per layer. Later blocks override earlier ones for the same files.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': restrict(
        SHARED_SELECTORS,
        MODULE_SELECTORS,
        PROPS_SELECTOR,
        SECRET_SELECTORS,
        TYPE_SELECTORS,
      ),
    },
  },
  {
    // Shared unions live in core and the platform bridge, next to their data.
    files: ['src/core/**/*.{ts,tsx}', 'src/lib/platform/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': restrict(
        SHARED_SELECTORS,
        MODULE_SELECTORS,
        PROPS_SELECTOR,
        SECRET_SELECTORS,
        TYPE_SELECTORS,
        UNION_SELECTORS,
      ),
    },
  },
  {
    // Preset literal checks would flag the data files themselves.
    files: ['src/core/presets/**'],
    rules: {
      'no-restricted-syntax': restrict(
        SHARED_SELECTORS,
        MODULE_SELECTORS,
        PROPS_SELECTOR,
        TYPE_SELECTORS,
        UNION_SELECTORS,
      ),
    },
  },
  {
    files: ['src/server/**/*.ts'],
    rules: {
      'no-restricted-syntax': restrict(
        SHARED_SELECTORS,
        MODULE_SELECTORS,
        PROPS_SELECTOR,
        SECRET_SELECTORS,
        SERVER_SELECTORS,
        TYPE_SELECTORS,
      ),
    },
  },
  {
    // Secrets code reads process.env directly.
    files: ['src/server/secrets/**'],
    rules: {
      'no-restricted-syntax': restrict(
        SHARED_SELECTORS,
        MODULE_SELECTORS,
        PROPS_SELECTOR,
        SERVER_SELECTORS,
        TYPE_SELECTORS,
      ),
    },
  },
  {
    // The keychain lazily loads its native module, the one allowed dynamic import.
    files: ['src/server/secrets/keychain.ts'],
    rules: {
      'no-restricted-syntax': restrict(
        SHARED_SELECTORS,
        MODULE_SELECTORS,
        PROPS_SELECTOR,
        TYPE_SELECTORS,
      ),
    },
  },
  {
    // Next route handlers take { params }, so drop only the props selector.
    // SECRET_SELECTORS stays: the old block dropped it by accident.
    files: ['src/app/api/**/route.ts'],
    rules: {
      'no-restricted-syntax': restrict(
        SHARED_SELECTORS,
        MODULE_SELECTORS,
        SECRET_SELECTORS,
        TYPE_SELECTORS,
      ),
    },
  },
  {
    // No functions as object properties inside components.
    files: ['src/features/**/*.tsx', 'src/ui/**/*.tsx'],
    rules: {
      'no-restricted-syntax': restrict(
        SHARED_SELECTORS,
        MODULE_SELECTORS,
        PROPS_SELECTOR,
        SECRET_SELECTORS,
        OBJECT_FUNCTION_SELECTOR,
        INLINE_FUNCTION_SELECTORS,
        TYPE_SELECTORS,
      ),
    },
  },

  // Exceptions
  {
    files: ['src/lib/platform/desktop.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['src/features/**', 'src/ui/**', 'src/lib/**', 'src/core/**'],
    rules: { 'no-console': 'error' },
  },
  {
    // Exported functions declare their return type outside components.
    files: ['src/core/**/*.{ts,tsx}', 'src/server/**/*.{ts,tsx}', 'src/lib/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/explicit-module-boundary-types': 'error' },
  },
  {
    files: ['tests/**'],
    rules: {
      '@typescript-eslint/max-params': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.{js,mjs,ts}'],
    ...tseslint.configs.disableTypeChecked,
  },

  prettier,

  // Blank-line grouping. After prettier, which turns some of these off.
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    plugins: { local: localPlugin },
    rules: {
      'local/padding-around-functions': 'error',
      'arrow-body-style': ['error', 'always'],
      curly: ['error', 'all'],
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: 'directive', next: '*' },
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'any', prev: 'import', next: 'import' },
        { blankLine: 'always', prev: ['const', 'let'], next: '*' },
        {
          blankLine: 'any',
          prev: ['singleline-const', 'singleline-let'],
          next: ['singleline-const', 'singleline-let'],
        },
        { blankLine: 'any', prev: 'singleline-export', next: 'singleline-export' },
        {
          blankLine: 'always',
          prev: '*',
          next: ['if', 'for', 'while', 'do', 'switch', 'try', 'throw', 'return'],
        },
        {
          blankLine: 'always',
          prev: '*',
          next: [
            'function',
            'class',
            'type',
            'interface',
            'multiline-const',
            'multiline-let',
            'multiline-expression',
            'multiline-export',
          ],
        },
        {
          blankLine: 'always',
          prev: [
            'block-like',
            'multiline-const',
            'multiline-let',
            'multiline-expression',
            'multiline-export',
            'type',
            'interface',
          ],
          next: '*',
        },
      ],
      '@stylistic/padded-blocks': ['error', 'never'],
      '@stylistic/lines-between-class-members': [
        'error',
        'always',
        { exceptAfterSingleLine: true },
      ],
      '@stylistic/lines-around-comment': [
        'error',
        {
          beforeBlockComment: true,
          allowBlockStart: true,
          allowObjectStart: true,
          allowArrayStart: true,
        },
      ],
    },
  },

  {
    // Callback props stay on props, or use a handle<Action> created in the component.
    // A function used only by one hook call is written inline in that call.
    files: ['src/**/*.tsx', 'src/**/use-*.ts'],
    rules: {
      'local/callback-props': 'error',
      'local/inline-hook-callbacks': 'error',
    },
  },

  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'docs/**',
    'src-tauri/**',
    'node_modules/**',
  ]),
])
