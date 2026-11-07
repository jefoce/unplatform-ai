import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => {
  return {
    endpoints: new Map<string, { id: string; instanceId: string | null }>(),
    limits: new Map<string, number>(),
  }
})

vi.mock('@/server/providers/custom/endpoint-source', () => {
  return {
    getEndpointSync: (id: string) => {
      return state.endpoints.get(id) ?? null
    },
    endpointQueueKey: (endpoint: { instanceId: string | null; id: string }) => {
      return endpoint.instanceId ?? endpoint.id
    },
  }
})

vi.mock('@/server/services/endpoint-health', () => {
  return {
    getMaxRunning: (key: string) => {
      return state.limits.get(key) ?? 1
    },
  }
})

const { createSubmitQueue } = await import('@/server/jobs/submit-queue-factory')

interface HarnessRecord {
  id: string
  status: string
  provider: string
  source?: { instanceId: string }
  submit: { stage: string; notBefore?: string }
}

interface Harness {
  records: Map<string, HarnessRecord>
  started: string[]
  queue: ReturnType<typeof createSubmitQueue>
  release: (id: string) => void
}

function record(id: string, provider: string, instanceId?: string): HarnessRecord {
  const source = provider === 'custom' && instanceId !== undefined ? { instanceId } : undefined

  return { id, status: 'submitting', provider, source, submit: { stage: 'grace' } }
}

function harness(key: string): Harness {
  const records = new Map<string, HarnessRecord>()
  const gates = new Map<string, () => void>()
  const started: string[] = []

  const queue = createSubmitQueue({
    key,
    load: async (id) => {
      return records.get(id) ?? null
    },
    list: async () => {
      return [...records.values()]
    },
    maxConcurrent: 2,
  })

  queue.configure(async (id) => {
    started.push(id)

    await new Promise<void>((resolve) => {
      gates.set(id, resolve)
    })

    return 'done'
  })

  return {
    records,
    started,
    queue,
    release: (id) => {
      gates.get(id)?.()
    },
  }
}

beforeEach(() => {
  state.endpoints.clear()
  state.limits.clear()
  state.endpoints.set('ep1', { id: 'ep1', instanceId: 'pack-1' })
  state.endpoints.set('ep2', { id: 'ep2', instanceId: 'pack-1' })
})

describe('custom submit queue limit', () => {
  it('runs one job at a time on one endpoint', async () => {
    const run = harness('queue-one-endpoint')

    run.records.set('a', record('a', 'custom', 'ep1'))
    run.records.set('b', record('b', 'custom', 'ep1'))

    await run.queue.start('a')
    await run.queue.start('b')

    await vi.waitFor(() => {
      expect(run.started).toEqual(['a'])
    })

    run.release('a')

    await vi.waitFor(() => {
      expect(run.started).toEqual(['a', 'b'])
    })
  })

  it('shares the limit when two endpoints report one pack instance', async () => {
    const run = harness('queue-shared-instance')

    run.records.set('a', record('a', 'custom', 'ep1'))
    run.records.set('b', record('b', 'custom', 'ep2'))

    await run.queue.start('a')
    await run.queue.start('b')

    await vi.waitFor(() => {
      expect(run.started).toEqual(['a'])
    })

    run.release('a')

    await vi.waitFor(() => {
      expect(run.started).toEqual(['a', 'b'])
    })
  })

  it('keeps the OpenRouter queue separate', async () => {
    const run = harness('queue-openrouter')

    run.records.set('a', record('a', 'custom', 'ep1'))
    run.records.set('b', record('b', 'openrouter'))

    await run.queue.start('a')
    await run.queue.start('b')

    await vi.waitFor(() => {
      expect([...run.started].sort()).toEqual(['a', 'b'])
    })
  })
})
