import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const HISTORY_DIR = path.join(process.cwd(), 'src/features/history')

function historyFiles(): string[] {
  return fs.readdirSync(HISTORY_DIR, { recursive: true, encoding: 'utf8' }).filter((name) => {
    return name.endsWith('.ts') || name.endsWith('.tsx')
  })
}

describe('history imports', () => {
  it('never reaches into the workspace feature', () => {
    const offenders = historyFiles().filter((name) => {
      const source = fs.readFileSync(path.join(HISTORY_DIR, name), 'utf8')

      return /from\s+['"][^'"]*workspace\//.test(source)
    })

    expect(offenders).toEqual([])
  })
})
