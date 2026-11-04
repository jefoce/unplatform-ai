import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC_DIR = path.join(process.cwd(), 'src')
const SOURCE_EXTENSIONS = new Set(['.css', '.js', '.jsx', '.mjs', '.ts', '.tsx'])
const REDUCED_MOTION = /prefers-reduced-motion|motion-reduce:|motion-safe:/

/** Source files under `src`, recursively. */
function sourceFiles(): string[] {
  return fs.readdirSync(SRC_DIR, { recursive: true, encoding: 'utf8' }).filter((file) => {
    return SOURCE_EXTENSIONS.has(path.extname(file))
  })
}

describe('reduced motion', () => {
  it('has no reduced-motion opt-out in src', () => {
    const offenders = sourceFiles().filter((file) => {
      return REDUCED_MOTION.test(fs.readFileSync(path.join(SRC_DIR, file), 'utf8'))
    })

    expect(offenders).toEqual([])
  })
})
