import { type Rule, RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, it } from 'vitest'

import rule from '../eslint-rules/inline-hook-callbacks.mjs'

RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  },
})

tester.run('inline-hook-callbacks', rule as Rule.RuleModule, {
  valid: [
    {
      name: 'keeps a function used by a hook and in JSX',
      code: `function Comp() {
  const handleSave = () => {}
  useAsyncAction(handleSave)
  return <button onClick={handleSave} />
}`,
    },
    {
      name: 'keeps a module-level function',
      code: `const handleSave = () => {}
function Comp() {
  useAsyncAction(handleSave)
}`,
    },
    {
      name: 'accepts an inline arrow',
      code: `function Comp() {
  useAsyncAction(async () => {})
}`,
    },
  ],
  invalid: [
    {
      name: 'rejects a named async action passed to useAsyncAction',
      code: `function Comp() {
  const save = async () => {
    await api()
  }
  useAsyncAction(save)
}`,
      errors: [{ messageId: 'inline', data: { name: 'save', hook: 'useAsyncAction' } }],
    },
    {
      name: 'rejects a named callback passed to useEffect',
      code: `function Comp() {
  const onResize = () => {}
  useEffect(onResize, [])
}`,
      errors: [{ messageId: 'inline', data: { name: 'onResize', hook: 'useEffect' } }],
    },
  ],
})
