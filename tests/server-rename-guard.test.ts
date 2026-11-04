import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const SERVER_DIR = path.join(process.cwd(), 'src/server')
const ATOMIC_FILE = 'fs/atomic-file.ts'

/** Files allowed to call fs.rename inside retryOnWindowsLock. */
const WRAPPED_ALLOW = new Set(['media/compat.ts'])

const WRAPPED_RENAME =
  /retryOnWindowsLock\(\s*\(\)\s*=>\s*\{[^{}]*fs\.rename\([^{}]*\)[^{}]*\}\s*\)/gs

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      return sourceFiles(full)
    }

    return entry.isFile() && entry.name.endsWith('.ts') ? [full] : []
  })
}

function relative(file: string): string {
  return path.relative(SERVER_DIR, file).split(path.sep).join('/')
}

describe('server renames', () => {
  it('wraps every raw fs.rename outside atomic-file', () => {
    const offenders = sourceFiles(SERVER_DIR)
      .filter((file) => {
        return relative(file) !== ATOMIC_FILE
      })
      .filter((file) => {
        return fs.readFileSync(file, 'utf8').includes('fs.rename(')
      })
      .filter((file) => {
        const rel = relative(file)

        if (!WRAPPED_ALLOW.has(rel)) {
          return true
        }

        return fs.readFileSync(file, 'utf8').replaceAll(WRAPPED_RENAME, '').includes('fs.rename(')
      })
      .map(relative)

    expect(offenders).toEqual([])
  })
})
