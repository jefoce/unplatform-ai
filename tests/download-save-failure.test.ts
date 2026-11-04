import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import type * as AtomicFile from '@/server/fs/atomic-file'
import type { JobSnapshot } from '@/server/providers/types'

import { storedRecord } from './helpers/stored-record'
import { waitFor } from './helpers/wait-for'

const root = path.join(os.tmpdir(), `cf-download-save-failure-${process.pid}-${Date.now()}`)

process.env.STORAGE_ROOT = root

const fetchContent = vi.hoisted(() => {
  return vi.fn<() => Promise<Response>>()
})

const control = vi.hoisted(() => {
  return { fail: false }
})

vi.mock('@/server/fs/atomic-file', async (importOriginal) => {
  const actual = await importOriginal<typeof AtomicFile>()

  return {
    ...actual,
    commitFile: async (params: Parameters<typeof actual.commitFile>[0]) => {
      if (control.fail) {
        throw Object.assign(new Error('locked'), { code: 'EPERM' })
      }

      return actual.commitFile(params)
    },
  }
})

vi.mock('@/server/providers/registry', () => {
  return {
    getVideoProvider: () => {
      return { fetchContent }
    },
  }
})

vi.mock('@/server/media/ffmpeg', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/server/media/ffmpeg')

  return {
    ...actual,
    probeMedia: async () => {
      return { durationSec: 1, width: null, height: null }
    },
  }
})

const JOB: JobSnapshot = {
  status: 'completed',
  generationId: null,
  expiresAt: null,
  urls: [],
  usage: null,
  error: null,
}

const JOB_ID = 'or-job-4242'
const SUBMITTED_AT = '2026-01-01T00:00:00.000Z'

const { downloadPaths } = await import('@/server/paths')
const { isDownloadQueued, queueDownload } = await import('@/server/jobs/download-queue')
const { saveGeneration } = await import('@/server/repos/generations')

beforeEach(async () => {
  control.fail = false
  await fs.mkdir(root, { recursive: true })
})

afterEach(() => {
  control.fail = false
  vi.restoreAllMocks()
})

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

function markedRecord(id: string): GenerationRecord {
  return storedRecord(id, {
    status: 'in_progress',
    download: { startedAt: SUBMITTED_AT },
    job: { id: JOB_ID, submittedAt: SUBMITTED_AT },
  })
}

async function waitForQueue(id: string): Promise<void> {
  await waitFor(async () => {
    return !isDownloadQueued(id)
  })
}

async function storedDownload(id: string): Promise<unknown> {
  const text = await fs.readFile(downloadPaths(id).json, 'utf8')
  const record = JSON.parse(text) as { download?: unknown }

  return record.download
}

interface ErrorLog {
  mock: { calls: unknown[][] }
}

function loggedId(log: ErrorLog, id: string): boolean {
  return log.mock.calls.some(([message]) => {
    return String(message).includes(id) && String(message).includes('EPERM')
  })
}

describe('download failure save', () => {
  it('logs the id and code and keeps the download marker when the save is locked', async () => {
    const id = '88888888-8888-4888-8888-888888888888'
    const record = markedRecord(id)

    await saveGeneration(record)
    fetchContent.mockRejectedValue(new Error('gone'))
    control.fail = true

    const log = vi.spyOn(console, 'error').mockImplementation(() => {})

    await queueDownload(record, JOB)
    await waitForQueue(id)

    expect(loggedId(log, id)).toBe(true)
    expect(await storedDownload(id)).toBeDefined()
  })

  it('keeps the download marker when an integrity failure save is locked', async () => {
    const id = '99999999-9999-4999-8999-999999999999'
    const record = markedRecord(id)

    await saveGeneration(record)
    fetchContent.mockResolvedValue(new Response(new Uint8Array([0, 0, 0, 0])))
    control.fail = true

    const log = vi.spyOn(console, 'error').mockImplementation(() => {})

    await queueDownload(record, JOB)
    await waitForQueue(id)

    expect(loggedId(log, id)).toBe(true)
    expect(await storedDownload(id)).toBeDefined()
  })
})
