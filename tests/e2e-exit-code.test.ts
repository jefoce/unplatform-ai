import fs from 'node:fs'

import { describe, expect, it } from 'vitest'

import { exitCodeFor } from './e2e/lib/exit-code.mjs'

const RUN = 'tests/e2e/run.mjs'

describe('exitCodeFor', () => {
  it('returns 0 without failures', () => {
    expect(exitCodeFor(0)).toBe(0)
  })

  it('returns 1 for any failure', () => {
    expect(exitCodeFor(1)).toBe(1)
    expect(exitCodeFor(3)).toBe(1)
  })
})

describe('e2e run exit', () => {
  const source = fs.readFileSync(RUN, 'utf8')

  it('exits through the failure count', () => {
    expect(source).toContain('process.exit(exitCodeFor(')
    expect(source).not.toContain('process.exitCode')
  })
})
