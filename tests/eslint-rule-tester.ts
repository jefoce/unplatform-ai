import { Linter, RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, it } from 'vitest'

RuleTester.describe = describe
RuleTester.it = it

const linter = new Linter({ configType: 'eslintrc' })
const loaded = linter.getRules().get('no-restricted-syntax')

if (!loaded) {
  throw new Error('no-restricted-syntax rule missing')
}

export const rule = loaded

export const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  },
})
