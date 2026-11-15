import { describe, expect, it } from 'vitest'

import { chromeStartError } from './e2e/lib/chrome-start-error.mjs'

function stderrLines(count: number): string {
  return Array.from({ length: count }, (_, index) => {
    return `line ${String(index + 1)}`
  }).join('\n')
}

describe('chromeStartError', () => {
  it('keeps only the last 40 stderr lines', () => {
    const message = chromeStartError({ exitCode: 127, stderr: stderrLines(50) })

    expect(message).toContain('exit code 127')
    expect(message).toContain('line 50')
    expect(message).not.toContain('line 10\n')
    expect(message.match(/^line /gm)).toHaveLength(40)
  })

  it('says still running when the exit code is unknown', () => {
    expect(chromeStartError({ exitCode: null, stderr: 'boom' })).toContain('still running')
  })

  it('says no stderr when stderr is empty', () => {
    expect(chromeStartError({ exitCode: 1, stderr: '' })).toContain('no stderr')
  })
})
