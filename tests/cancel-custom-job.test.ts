import { describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '../src/core/schemas/generation-record'
import { storedRecord } from './helpers/stored-record'

const state = vi.hoisted(() => {
  return {
    record: null as GenerationRecord | null,
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

vi.mock('@/server/providers/registry', () => {
  return {
    getVideoProvider: () => {
      return { cancel: state.cancel }
    },
  }
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

describe('POST /api/generations/[id]/cancel', () => {
  it('stops a running custom job on its endpoint', async () => {
    state.record = customRecord()
    state.cancel.mockReset()
    state.cancel.mockResolvedValue(undefined)

    const response = await POST(request(state.record.id), context(state.record.id))

    expect(response.status).toBe(204)

    expect(state.cancel).toHaveBeenCalledWith({
      jobId: 'job-1',
      submittedAt: '2026-01-01T00:00:00.000Z',
    })

    expect(state.deleteFiles).not.toHaveBeenCalled()
  })

  it('refuses an OpenRouter job past the grace window', async () => {
    state.record = storedRecord('openrouter-record', {
      provider: 'openrouter',
      status: 'in_progress',
      job: { id: 'job-2', submittedAt: '2026-01-01T00:00:00.000Z' },
    })

    state.cancel.mockReset()

    const response = await POST(request(state.record.id), context(state.record.id))

    expect(response.status).toBe(409)
    expect(state.cancel).not.toHaveBeenCalled()
  })
})
