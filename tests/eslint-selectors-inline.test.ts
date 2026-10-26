import { INLINE_FUNCTION_SELECTORS } from '../eslint-rules/selectors.mjs'
import { rule, tester } from './eslint-rule-tester'

tester.run('no-restricted-syntax inline function selectors', rule, {
  valid: [
    {
      name: 'handler by reference',
      code: `function Comp() {
  const handleSave = () => {}
  return <button onClick={handleSave} />
}`,
      options: INLINE_FUNCTION_SELECTORS,
    },
  ],
  invalid: [
    {
      name: 'inline arrow in jsx',
      code: 'function Comp() { return <button onClick={() => save()} /> }',
      options: INLINE_FUNCTION_SELECTORS,
      errors: 1,
    },
    {
      name: 'inline bind call in jsx',
      code: 'function Comp() { return <button onClick={handleSave.bind(null)} /> }',
      options: INLINE_FUNCTION_SELECTORS,
      errors: 1,
    },
  ],
})
