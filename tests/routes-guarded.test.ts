import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const API_DIR = path.join(process.cwd(), 'src/app/api')

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)

    if (entry.isDirectory()) return routeFiles(full)

    return entry.isFile() && entry.name === 'route.ts' ? [full] : []
  })
}

const NO_SESSION_ALLOWED = ['health/route.ts', 'session/route.ts', 'dev/remote/']

function isAllowed(rel: string): boolean {
  return NO_SESSION_ALLOWED.some((allowed) => rel === allowed || rel.startsWith(allowed))
}

describe('route guards', () => {
  it('every API route calls assertLocalRequest', () => {
    const files = routeFiles(API_DIR)

    expect(files.length).toBeGreaterThan(0)
    const unguarded = files.filter(
      (file) => !readFileSync(file, 'utf8').includes('assertLocalRequest('),
    )

    expect(unguarded).toEqual([])
  })

  it('only health, session and dev/remote skip the session check', () => {
    const offenders = routeFiles(API_DIR)
      .filter((file) => readFileSync(file, 'utf8').includes('session: false'))
      .map((file) => path.relative(API_DIR, file).split(path.sep).join('/'))
      .filter((rel) => !isAllowed(rel))

    expect(offenders).toEqual([])
  })
})
