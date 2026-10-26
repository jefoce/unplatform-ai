import { Linter, RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, it } from 'vitest'

import { UNION_SELECTORS } from '../eslint-rules/selectors.mjs'

RuleTester.describe = describe
RuleTester.it = it

const linter = new Linter({ configType: 'eslintrc' })
const rule = linter.getRules().get('no-restricted-syntax')

if (!rule) {
  throw new Error('no-restricted-syntax rule missing')
}

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  },
})

tester.run('no-restricted-syntax shared union selectors', rule, {
  valid: [
    {
      name: 'union derived from an as const array',
      code: 'export type Foo = (typeof LIST)[number]',
      options: UNION_SELECTORS,
    },
  ],
  invalid: [
    {
      name: 'exported literal union',
      code: "export type Foo = 'a' | 'b'",
      options: UNION_SELECTORS,
      errors: 1,
    },
  ],
})
