import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const CORE_DIR = path.join(process.cwd(), 'src/core')
const FORBIDDEN = /(?:['"`]\/api\/|\bwindow\.|\bdocument\.)/

const coreFiles = (): string[] => {
  return fs.readdirSync(CORE_DIR, { recursive: true, encoding: 'utf8' })
}

describe('core boundaries', () => {
  it('has no DOM access or route literals', () => {
    const offenders = coreFiles().filter((file) => {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) {
        return false
      }

      return FORBIDDEN.test(fs.readFileSync(path.join(CORE_DIR, file), 'utf8'))
    })

    expect(offenders).toEqual([])
  })
})
