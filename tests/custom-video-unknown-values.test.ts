import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'
import type { JobSnapshot } from '@/server/providers/types'

import jobInProgressFixture from '../docs/protocol/upai-1/fixtures/job-in_progress.json'

vi.mock('@/server/secrets', () => {
  return {
    getSecret: (name: string) => {
      return name === 'CUSTOM_ENDPOINT_TOKENS' ? JSON.stringify({ ep1: 'tok' }) : null
    },
    secretsReady: async () => {},
  }
})

const { createCustomVideoProvider } = await import('@/server/providers/custom/video')

const ENDPOINT: CustomEndpoint = {
  id: 'ep1',
  label: 'Local',
  badge: 'CU1',
  baseUrl: 'http://127.0.0.1:8188',
  enabled: true,
  pricing: { mode: 'model', usd: 0 },
  instanceId: 'pack-1',
  lastHealth: null,
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function respond(payload: unknown): void {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

function poll(): Promise<JobSnapshot> {
  return createCustomVideoProvider(ENDPOINT).getJob({
    jobId: jobInProgressFixture.id,
    submittedAt: '',
  })
}

describe('custom video unknown wire values', () => {
  it('keeps the provider online for an unknown waiting value', async () => {
    respond({
      ...jobInProgressFixture,
      progress: { ...jobInProgressFixture.progress, percent: 100, waiting_on: 'new_queue' },
    })

    const snapshot = await poll()

    expect(snapshot).toMatchObject({ progress: { waitingOn: null } })
  })

  it('keeps an unknown status neutral instead of done', async () => {
    respond({ ...jobInProgressFixture, status: 'queued' })

    const snapshot = await poll()

    expect(snapshot).toMatchObject({ status: 'pending' })
  })

  it('ignores an unknown job kind', async () => {
    respond({ ...jobInProgressFixture, kind: 'audio' })

    const snapshot = await poll()

    expect(snapshot).toMatchObject({ status: 'in_progress' })
  })
})
