import { isNil } from 'lodash-es'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '../src/core/schemas/generation-record'

const gate = vi.hoisted(() => {
  const sendStarted = Promise.withResolvers<void>()
  const sendGate = Promise.withResolvers<void>()
  const completeLanded = Promise.withResolvers<void>()

  return {
    sendStarted,
    sendGate,
    completeLanded,
    hasReleasedSend: false,
    hasArmedRace: false,
  }
})

const control = vi.hoisted(() => {
  return {
    current: null as GenerationRecord | null,
    saved: [] as GenerationRecord[],
    updateCalls: 0,
  }
})

vi.mock('@/server/secrets', () => {
  return { secretsReady: async () => {} }
})

vi.mock('@/server/repos/uploads', () => {
  return {
    getUpload: async () => {
      return null
    },
  }
})

vi.mock('@/server/storage/registry', () => {
  return {
    getObjectStore: () => {
      return null
    },
  }
})

vi.mock('@/server/jobs/submit-retry', () => {
  return {
    shouldRetryAsBase64: () => {
      return false
    },
  }
})

vi.mock('@/server/providers/registry', () => {
  return {
    getVideoProvider: () => {
      return {
        submit: async () => {
          return { jobId: 'job-1', status: 'pending' }
        },
      }
    },
  }
})

vi.mock('@/server/jobs/download-queue', () => {
  return {
    isDownloadQueued: () => {
      return false
    },
  }
})

async function write(record: GenerationRecord): Promise<GenerationRecord> {
  const saved: GenerationRecord = { ...record, updatedAt: new Date().toISOString() }

  control.current = saved
  control.saved.push(saved)

  if (!isNil(saved.job?.id)) {
    gate.completeLanded.resolve()
  }

  if (saved.submit?.stage === 'sending' && !gate.hasReleasedSend) {
    gate.hasReleasedSend = true
    gate.sendStarted.resolve()
    await gate.sendGate.promise
  }

  return saved
}

vi.mock('@/server/repos/generations', () => {
  return {
    getGeneration: async () => {
      const snapshot = control.current

      const isStaleSending =
        !isNil(snapshot) && isNil(snapshot.job) && snapshot.submit?.stage === 'sending'

      // The poller snapshots a sending record, then complete lands before it writes.
      if (isStaleSending && !gate.hasArmedRace) {
        gate.hasArmedRace = true
        gate.sendGate.resolve()
        await gate.completeLanded.promise
      }

      return snapshot
    },
    saveGeneration: write,
    updateGeneration: async (
      _id: string,
      patch: (record: GenerationRecord) => GenerationRecord | null,
    ) => {
      control.updateCalls += 1
      const current = control.current

      if (isNil(current)) {
        return null
      }

      const next = patch(current)

      if (isNil(next)) {
        return null
      }

      return write(next)
    },
    listActiveGenerations: async () => {
      if (isNil(control.current)) {
        return []
      }

      return [control.current]
    },
  }
})

const { processById } = await import('@/server/jobs/poller')
const { runSubmit } = await import('@/server/jobs/run-submit')

afterEach(() => {
  gate.sendGate.resolve()
  gate.hasReleasedSend = false
  gate.hasArmedRace = false
  control.current = null
  control.saved = []
  control.updateCalls = 0
})

describe('poller processById race', () => {
  it('keeps the paid job id and pending status when its snapshot goes stale before complete lands', async () => {
    control.current = makeRecord()

    const submission = runSubmit(control.current.id)

    await gate.sendStarted.promise
    await processById(control.current.id)
    await submission

    expect(control.updateCalls).toBe(1)

    expect(
      control.saved.some((record) => {
        return record.status === 'failed'
      }),
    ).toBe(false)

    const final = control.current

    expect(final?.status).toBe('pending')
    expect(final?.job?.id).toBe('job-1')
    expect(final?.submit).toBeUndefined()
    expect(final?.error).toBeUndefined()
  })
})

function makeRecord(): GenerationRecord {
  const now = new Date().toISOString()

  return {
    id: '11111111-1111-4111-8111-111111111111',
    createdAt: now,
    updatedAt: now,
    status: 'submitting',
    provider: 'openrouter',
    input: {
      presetId: 'wan-3.0',
      tab: 'frames',
      prompt: '',
      audio: false,
      duration: 5,
      aspectRatio: 'auto',
      resolution: '720p',
      frames: { start: null, end: null },
      references: [],
      seed: null,
    },
    preset: { id: 'wan-3.0', title: 'Wan 3.0', slug: 'alibaba/wan-3.0' },
    inputsSnapshot: {},
    submit: { stage: 'grace', notBefore: '2020-01-01T00:00:00.000Z' },
    seedUsed: null,
    favorite: false,
    cost: {
      currency: 'USD',
      pricePerSec: 0,
      priceSource: 'mock',
      estimatedUsd: 0,
      actualUsd: null,
      isByok: null,
      billed: null,
    },
  }
}
