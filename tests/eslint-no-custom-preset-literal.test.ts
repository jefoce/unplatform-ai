import type { Rule } from 'eslint'

import rule from '../eslint-rules/no-custom-preset-literal.mjs'
import { tester } from './eslint-rule-tester'

tester.run('no-custom-preset-literal', rule as Rule.RuleModule, {
  valid: [
    {
      name: 'allows a custom id inside presets',
      filename: 'src/core/presets/custom/index.ts',
      code: "const id = 'custom.a.b'",
    },
    {
      name: 'allows a non-custom string',
      code: "const id = 'openrouter.a.b'",
    },
  ],
  invalid: [
    {
      name: 'rejects a custom id literal outside presets',
      filename: 'src/features/generator/example.ts',
      code: "const id = 'custom.a.b'",
      errors: [{ messageId: 'literal' }],
    },
    {
      name: 'rejects a custom id template outside presets',
      filename: 'src/features/generator/example.ts',
      code: 'const id = `custom.${modelId}`',
      errors: [{ messageId: 'literal' }],
    },
  ],
})
