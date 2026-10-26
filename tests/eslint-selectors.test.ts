import {
  MODULE_SELECTORS,
  SERVER_SELECTORS,
  SHARED_SELECTORS,
  TERNARY_SELECTORS,
  TYPE_SELECTORS,
} from '../eslint-rules/selectors.mjs'
import { rule, tester } from './eslint-rule-tester'

tester.run('no-restricted-syntax type selectors', rule, {
  valid: [
    {
      name: 'named interface',
      code: 'interface Foo { a: string }',
      options: TYPE_SELECTORS,
    },
    {
      name: 'typeof list indexed by number',
      code: 'type Foo = (typeof LIST)[number]',
      options: TYPE_SELECTORS,
    },
    {
      name: 'named deriving alias',
      code: 'type Foo = Partial<Record<string, string>>',
      options: TYPE_SELECTORS,
    },
  ],
  invalid: [
    {
      name: 'bare object literal type',
      code: 'type Foo = { a: string }',
      options: TYPE_SELECTORS,
      errors: 1,
    },
    {
      name: 'nested Record',
      code: 'type Foo = Record<string, Record<string, number>>',
      options: TYPE_SELECTORS,
      errors: 1,
    },
    {
      name: 'nested z.object',
      code: 'const schema = z.object({ a: z.object({ b: z.string() }) })',
      options: TYPE_SELECTORS,
      errors: 1,
    },
    {
      name: 'indexed access',
      code: 'const size: Bar["key"] = 1',
      options: TYPE_SELECTORS,
      errors: 1,
    },
    {
      name: 'stray ReturnType',
      code: 'const timer: ReturnType<typeof setInterval> = 1',
      options: TYPE_SELECTORS,
      errors: 1,
    },
    {
      name: 'pure type alias',
      code: 'type Foo = Bar',
      options: TYPE_SELECTORS,
      errors: 1,
    },
  ],
})

tester.run('no-restricted-syntax ternary selectors', rule, {
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

tester.run('no-restricted-syntax module selectors', rule, {
  valid: [
    {
      name: 'plain export declaration',
      code: 'export const a = 1',
      options: MODULE_SELECTORS,
    },
  ],
  invalid: [
    {
      name: 'export all from',
      code: "export * from './x'",
      options: MODULE_SELECTORS,
      errors: 1,
    },
    {
      name: 'named re-export',
      code: "export { a } from './x'",
      options: MODULE_SELECTORS,
      errors: 1,
    },
  ],
})

tester.run('no-restricted-syntax server selectors', rule, {
  valid: [
    {
      name: 'static import',
      code: "import x from './x'",
      options: SERVER_SELECTORS,
    },
  ],
  invalid: [
    {
      name: 'dynamic import',
      code: "async function load() { return import('./x') }",
      options: SERVER_SELECTORS,
      errors: 1,
    },
  ],
})

tester.run('no-restricted-syntax shared selectors', rule, {
  valid: [
    {
      name: 'finally callback without a return',
      code: 'promise.finally(() => { cleanup() })',
      options: SHARED_SELECTORS,
    },
    {
      name: 'const array instead of an enum',
      code: "const KINDS = ['image', 'video'] as const",
      options: SHARED_SELECTORS,
    },
    {
      name: 'store set call as a statement',
      code: 'const setView = (view) => { set({ view }) }',
      options: SHARED_SELECTORS,
    },
  ],
  invalid: [
    {
      name: 'finally callback returns a value',
      code: 'promise.finally(() => { return cleanup() })',
      options: SHARED_SELECTORS,
      errors: 1,
    },
    {
      name: 'enum declaration',
      code: 'enum Kind { Image, Video }',
      options: SHARED_SELECTORS,
      errors: 1,
    },
    {
      name: 'store set call returned',
      code: 'const setView = (view) => { return set({ view }) }',
      options: SHARED_SELECTORS,
      errors: 1,
    },
  ],
})
