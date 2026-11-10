import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '../src/core/schemas/generation-record'
import { storedRecord } from './helpers/stored-record'

const state = vi.hoisted(() => {
  return {
    record: null as GenerationRecord | null,
    endpoints: new Set<string>(),
    getProvider: vi.fn(),
    cancel: vi.fn(),
    deleteFiles: vi.fn(),
    cancelScheduled: vi.fn(),
  }
})

vi.mock('@/server/repos/generations', () => {
  return {
    getGeneration: async () => {
      return state.record
    },
    deleteGenerationFiles: state.deleteFiles,
  }
})

vi.mock('@/server/jobs/submit-queue', () => {
  return { cancelScheduledSubmit: state.cancelScheduled }
})

vi.mock('@/server/providers/custom/endpoint-source', () => {
  return {
    getEndpointSync: (id: string) => {
      return state.endpoints.has(id) ? { id } : null
    },
  }
})

vi.mock('@/server/providers/registry', () => {
  return { getVideoProvider: state.getProvider }
})

vi.mock('@/server/session', () => {
  return {
    hasSession: () => {
      return true
    },
  }
})

const { POST } = await import('@/app/api/generations/[id]/cancel/route')

function request(id: string): Request {
  return new Request(`http://127.0.0.1:3000/api/generations/${id}/cancel`, {
    method: 'POST',
    headers: { host: '127.0.0.1:3000', 'sec-fetch-site': 'same-origin' },
  })
}

const context = (id: string) => {
  return { params: Promise.resolve({ id }) }
}

function customRecord(overrides: Partial<GenerationRecord> = {}): GenerationRecord {
  return storedRecord('custom-record', {
    provider: 'custom',
    status: 'in_progress',
    source: {
      kind: 'custom',
      instanceId: 'cu1',
      badge: 'CU1',
      presetTitle: 'Wan 2.2 I2V',
      workflowName: 'Wan 2.2',
      endpointLabel: 'Studio PC',
      local: true,
    },
    job: { id: 'job-1', submittedAt: '2026-01-01T00:00:00.000Z' },
    ...overrides,
  })
}

beforeEach(() => {
  state.endpoints.clear()
  state.endpoints.add('cu1')
  state.cancel.mockReset()
  state.cancel.mockResolvedValue(undefined)
  state.getProvider.mockReset()
  state.getProvider.mockReturnValue({ cancel: state.cancel })
})

describe('POST /api/generations/[id]/cancel', () => {
  it('stops a running custom job on its endpoint', async () => {
    state.record = customRecord()

    const response = await POST(request(state.record.id), context(state.record.id))

    expect(response.status).toBe(204)

    expect(state.cancel).toHaveBeenCalledWith({
      jobId: 'job-1',
      submittedAt: '2026-01-01T00:00:00.000Z',
    })

    expect(state.deleteFiles).not.toHaveBeenCalled()
  })

  it('returns 409 without resolving a provider when the endpoint was removed', async () => {
    state.record = customRecord()
    state.endpoints.clear()

    const response = await POST(request(state.record.id), context(state.record.id))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'This endpoint was removed.' })
    expect(state.getProvider).not.toHaveBeenCalled()
    expect(state.cancel).not.toHaveBeenCalled()
  })

  it('releases the record lock before a slow cancel resolves', async () => {
    state.record = customRecord()

    const slowCancel = Promise.withResolvers<void>()

    state.cancel.mockReset()
    state.cancel.mockReturnValue(slowCancel.promise)

    const pending = POST(request(state.record.id), context(state.record.id))

    await vi.waitFor(() => {
      expect(state.cancel).toHaveBeenCalled()
    })

    const { withLock } = await import('@/server/sync/lock')
    let hasAcquired = false

    const lockTask = withLock(state.record.id, async () => {
      hasAcquired = true
    })

    await vi.waitFor(() => {
      expect(hasAcquired).toBe(true)
    })

    slowCancel.resolve()
    await lockTask
    expect((await pending).status).toBe(204)
  })

  it('refuses an OpenRouter job past the grace window', async () => {
    state.record = storedRecord('openrouter-record', {
      provider: 'openrouter',
      status: 'in_progress',
      job: { id: 'job-2', submittedAt: '2026-01-01T00:00:00.000Z' },
    })

    const response = await POST(request(state.record.id), context(state.record.id))

    expect(response.status).toBe(409)
    expect(state.cancel).not.toHaveBeenCalled()
  })
})
