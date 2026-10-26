import { type Rule, RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, it } from 'vitest'

import rule from '../eslint-rules/padding-around-functions.mjs'

RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  },
})

tester.run('padding-around-functions', rule as Rule.RuleModule, {
  valid: [
    {
      name: 'groups value constants',
      code: `const first = 1
const second = 2`,
    },
    {
      name: 'keeps handlers already separated',
      code: `const isOpen = true

const handleClose = () => {}

const handleOpen = () => {}`,
    },
  ],
  invalid: [
    {
      name: 'adds a blank line between function constants',
      code: `const handleOne = () => {}
const handleTwo = () => {}`,
      output: `const handleOne = () => {}

const handleTwo = () => {}`,
      errors: [{ messageId: 'blankLine' }],
    },
    {
      name: 'adds a blank line before a wrapped handler',
      code: `const isOpen = true
const handleToggle = useCallback(() => {}, [])`,
      output: `const isOpen = true

const handleToggle = useCallback(() => {}, [])`,
      errors: [{ messageId: 'blankLine' }],
    },
    {
      name: 'handles an exported function constant',
      code: `const isOpen = true
export const handleX = () => {}`,
      output: `const isOpen = true

export const handleX = () => {}`,
      errors: [{ messageId: 'blankLine' }],
    },
    {
      name: 'inserts after a trailing comment',
      code: `const handleOne = () => {} // one
const handleTwo = () => {}`,
      output: `const handleOne = () => {} // one

const handleTwo = () => {}`,
      errors: [{ messageId: 'blankLine' }],
    },
    {
      name: 'keeps a leading comment with its statement',
      code: `const isOpen = true
// two
const handleTwo = () => {}`,
      output: `const isOpen = true

// two
const handleTwo = () => {}`,
      errors: [{ messageId: 'blankLine' }],
    },
  ],
})
