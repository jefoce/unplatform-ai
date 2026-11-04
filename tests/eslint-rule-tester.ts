import { Linter, RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, it } from 'vitest'

RuleTester.describe = describe
RuleTester.it = it

const linter = new Linter({ configType: 'eslintrc' })
const loaded = linter.getRules().get('no-restricted-syntax')
const loadedImports = linter.getRules().get('no-restricted-imports')

if (!loaded || !loadedImports) {
  throw new Error('restricted import rules missing')
}

export const rule = loaded
export const importsRule = loadedImports

export const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  },
})
