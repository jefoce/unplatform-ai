import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EXPORT_TOKEN_TTL_MS } from '@/core/constants'
import { rememberExportFolder, rememberExportPath } from '@/server/services/export-tokens'

const START = new Date('2026-01-01T00:00:00Z')

function storeOf(name: string): Map<unknown, unknown> {
  const host = globalThis as Record<string, unknown>

  return host[`__upai_${name}`] as Map<unknown, unknown>
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
  storeOf('exportTokens').clear()
  storeOf('exportFolders').clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('export token sweep', () => {
  it('drops an expired path when a new path is remembered', () => {
    const oldTarget = path.resolve('/tmp/old-export.mp4')
    const newTarget = path.resolve('/tmp/new-export.mp4')

    rememberExportPath(oldTarget)
    vi.advanceTimersByTime(EXPORT_TOKEN_TTL_MS + 1)
    rememberExportPath(newTarget)

    expect([...storeOf('exportTokens').keys()]).toEqual([newTarget])
  })

  it('drops an expired folder grant when a new grant is remembered', () => {
    const oldDir = path.resolve('/tmp/old-export-dir')
    const newDir = path.resolve('/tmp/new-export-dir')

    rememberExportFolder(oldDir, 1)
    vi.advanceTimersByTime(EXPORT_TOKEN_TTL_MS + 1)
    rememberExportFolder(newDir, 1)

    expect([...storeOf('exportFolders').keys()]).toEqual([newDir])
  })
})
