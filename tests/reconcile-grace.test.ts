import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GRACE_STALE_MS } from '@/core/constants'
import { isStaleGrace } from '@/core/submit-state'
import type { GenerationRecord } from '@/core/types'

const NOW = Date.parse('2026-01-01T00:00:00.000Z')
let root = ''

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'upai-grace-'))
})

afterEach(async () => {
  vi.doUnmock('@/server/jobs/submit-queue')
  vi.unstubAllEnvs()
  vi.resetModules()
  await fs.rm(root, { recursive: true, force: true })
})

function grace(atMs: number, status: GenerationRecord['status'] = 'submitting') {
  return {
    status,
    submit: { stage: 'grace' as const, notBefore: new Date(atMs).toISOString() },
  }
}

describe('isStaleGrace', () => {
  it('cancels a grace record more than a minute past notBefore', () => {
    expect(isStaleGrace(grace(NOW - GRACE_STALE_MS - 1), NOW)).toBe(true)
    expect(isStaleGrace(grace(NOW - 2 * 60_000), NOW)).toBe(true)
  })

  it('resumes a recent grace record', () => {
    expect(isStaleGrace(grace(NOW - GRACE_STALE_MS), NOW)).toBe(false)
    expect(isStaleGrace(grace(NOW - 10_000), NOW)).toBe(false)
  })

  it('ignores non-grace records', () => {
    expect(isStaleGrace(grace(NOW - 120_000, 'pending'), NOW)).toBe(false)
    expect(isStaleGrace({ status: 'submitting', submit: { stage: 'uploading' } }, NOW)).toBe(false)
  })
})

describe('reconcile grace cancel', () => {
  it('saves an old grace record as cancelled with the explanation', async () => {
    vi.stubEnv('STORAGE_ROOT', root)
    const downloads = path.join(root, 'downloads')

    await fs.mkdir(downloads, { recursive: true })
    const id = '11111111-1111-4111-8111-111111111111'
    const notBefore = new Date(Date.now() - 120_000).toISOString()
    const record = {
      id,
      createdAt: notBefore,
      updatedAt: notBefore,
      status: 'submitting',
      submit: { stage: 'grace', notBefore },
    }

    await fs.writeFile(path.join(downloads, `${id}.json`), JSON.stringify(record))

    vi.doMock('@/server/jobs/submit-queue', () => ({
      isSubmitOwned: () => false,
      resumeGraceSubmits: vi.fn(),
    }))
    const { reconcile, GRACE_EXPIRED_TEXT } = await import('@/server/jobs/reconcile')

    await reconcile()

    const saved = JSON.parse(await fs.readFile(path.join(downloads, `${id}.json`), 'utf8'))

    expect(saved.status).toBe('cancelled')
    expect(saved.error).toBe(GRACE_EXPIRED_TEXT)
    expect(saved.submit).toBeUndefined()
  })
})
