import { Linter, RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, it } from 'vitest'

import { TERNARY_SELECTORS } from '../eslint-rules/selectors.mjs'

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

tester.run('no-restricted-syntax', rule, {
  valid: [
    {
      name: 'label pick in a const',
      code: 'const label = isOpen ? "Close" : "Open"',
      options: TERNARY_SELECTORS,
    },
    {
      name: 'binary branch in a const',
      code: 'const size = count > 1 ? count - 1 : count',
      options: TERNARY_SELECTORS,
    },
    {
      name: 'identifier branches in a const',
      code: 'const icon = isOn ? A : B',
      options: TERNARY_SELECTORS,
    },
  ],
  invalid: [
    {
      name: 'return is not a const value',
      code: 'function pick() { return cond ? a : b }',
      options: TERNARY_SELECTORS,
      errors: 1,
    },
    {
      name: 'call argument is not a const value',
      code: 'fn(isX ? a : b)',
      options: TERNARY_SELECTORS,
      errors: 1,
    },
    {
      name: 'jsx branch in the consequent',
      code: 'const element = isOn ? <A /> : value',
      options: TERNARY_SELECTORS,
      errors: 1,
    },
    {
      name: 'jsx branch in the alternate',
      code: 'const element = isOn ? value : <B />',
      options: TERNARY_SELECTORS,
      errors: 1,
    },
    {
      name: 'call branch in the consequent',
      code: 'const value = isOn ? getA() : other',
      options: TERNARY_SELECTORS,
      errors: 1,
    },
    {
      name: 'call branch in the alternate',
      code: 'const value = isOn ? other : getB()',
      options: TERNARY_SELECTORS,
      errors: 1,
    },
    {
      name: 'logical test',
      code: 'const value = a && b ? 1 : 2',
      options: TERNARY_SELECTORS,
      errors: 1,
    },
    {
      name: 'conditional test',
      code: 'const value = (a ? b : c) ? 1 : 2',
      options: TERNARY_SELECTORS,
      errors: 2,
    },
  ],
})
