import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '@/core/types'

const control = vi.hoisted(() => ({ current: null as GenerationRecord | null }))

const sendGate = vi.hoisted(() => {
  const sending = Promise.withResolvers<void>()
  const gate = Promise.withResolvers<void>()

  return {
    enter: sending.resolve,
    open: gate.resolve,
    pending: sending.promise,
    gate: gate.promise,
  }
})

const submitVideo = vi.hoisted(() => vi.fn(async () => ({ id: 'job-1', status: 'pending' })))

vi.mock('@/server/secrets', () => ({ secretsReady: async () => {} }))
vi.mock('@/server/repos/uploads', () => ({ getUpload: async () => null }))
vi.mock('@/server/remote/remote-store', () => ({ getRemoteStore: () => null }))
vi.mock('@/server/jobs/poller', () => ({ startPoller: () => {} }))
vi.mock('@/server/jobs/submit-retry', () => ({ shouldRetryAsBase64: () => false }))
vi.mock('@/server/openrouter/client', () => ({
  OpenRouterError: class OpenRouterError extends Error {},
  stripStatusPrefix: (message: string) => message,
  submitVideo,
}))
vi.mock('@/server/repos/generations', () => ({
  getGeneration: async () => control.current,
  saveGeneration: async (record: GenerationRecord) => {
    if (record.submit?.stage === 'sending') {
      sendGate.enter()
      await sendGate.gate
    }

    control.current = { ...record, updatedAt: new Date().toISOString() }

    return control.current
  },
}))

const { runSubmit } = await import('@/server/jobs/run-submit')
const { sendingCount, waitForSendingDone } = await import('@/server/jobs/submit-queue')

afterEach(() => {
  sendGate.open()
  control.current = null
  submitVideo.mockClear()
})

describe('runSubmit sending stage', () => {
  it('keeps shutdown waiting while the stage save is still pending', async () => {
    control.current = makeRecord()
    const run = runSubmit(control.current.id)

    await sendGate.pending
    expect(sendingCount()).toBe(1)
    expect(await waitForSendingDone(20)).toBe(false)

    sendGate.open()
    await run

    expect(submitVideo).toHaveBeenCalledTimes(1)
    expect(sendingCount()).toBe(0)
  })
})

function makeRecord(): GenerationRecord {
  const now = new Date().toISOString()

  return {
    id: '11111111-1111-4111-8111-111111111111',
    createdAt: now,
    updatedAt: now,
    status: 'submitting',
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
