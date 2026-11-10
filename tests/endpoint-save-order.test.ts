import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { EndpointInput } from '@/core/api/endpoints'
import type * as EndpointRepo from '@/server/repos/endpoints'
import type * as EndpointSaveService from '@/server/services/endpoint-save'
import type * as EndpointTokenService from '@/server/services/endpoint-tokens'

const ROOT = path.join(os.tmpdir(), `cf-endpoint-save-order-${process.pid}-${Date.now()}`)
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

const repo = vi.hoisted(() => {
  return { isApplyFailing: false, applyDelayMs: 0, tokenSeenOnApply: null as string | null }
})

const tokenState = vi.hoisted(() => {
  return { isWriteFailing: false }
})

vi.mock('@/server/repos/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof EndpointRepo>()

  return {
    ...actual,
    applyEndpoints: async (params: EndpointRepo.ApplyEndpointsParams) => {
      if (repo.applyDelayMs > 0) {
        await new Promise((resolve) => {
          setTimeout(resolve, repo.applyDelayMs)
        })
      }

      if (repo.isApplyFailing) {
        throw new Error('endpoint write failed')
      }

      const tokens = await import('@/server/services/endpoint-tokens')

      repo.tokenSeenOnApply = tokens.readEndpointToken(params.entries[0]?.id ?? '')

      return actual.applyEndpoints(params)
    },
  }
})

vi.mock('@/server/services/endpoint-tokens', async (importOriginal) => {
  const actual = await importOriginal<typeof EndpointTokenService>()

  return {
    ...actual,
    writeEndpointTokens: async (serialized: string) => {
      if (tokenState.isWriteFailing) {
        throw new Error('token write failed')
      }

      return actual.writeEndpointTokens(serialized)
    },
  }
})

let service: typeof EndpointSaveService
let tokens: typeof EndpointTokenService

function endpoint(label: string, token?: string): EndpointInput {
  return {
    id: null,
    label,
    badge: null,
    baseUrl: 'http://127.0.0.1:8188',
    enabled: true,
    pricing: { mode: 'model', usd: 0 },
    instanceId: null,
    lastHealth: null,
    token,
  }
}

beforeAll(async () => {
  const secrets = await import('@/server/secrets')

  secrets.__setSecretsBackendForTests((await import('./helpers/secrets')).memoryBackend())
  await secrets.secretsReady()

  service = await import('@/server/services/endpoint-save')
  tokens = await import('@/server/services/endpoint-tokens')
})

beforeEach(async () => {
  repo.isApplyFailing = false
  repo.applyDelayMs = 0
  repo.tokenSeenOnApply = null
  tokenState.isWriteFailing = false

  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(path.join(ROOT, 'data'), { recursive: true })

  const secrets = await import('@/server/secrets')

  await secrets.setSecrets({ CUSTOM_ENDPOINT_TOKENS: null })
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

describe('endpoint save order', () => {
  it('writes the tokens before the endpoints file', async () => {
    const saved = await service.saveEndpoints({ endpoints: [endpoint('Studio', 'abcd1234')] })
    const id = saved.endpoints[0]?.id ?? ''

    expect(repo.tokenSeenOnApply).toBe('abcd1234')
    expect(tokens.readEndpointToken(id)).toBe('abcd1234')
  })

  it('leaves the endpoints file empty when the token write fails', async () => {
    tokenState.isWriteFailing = true

    await expect(
      service.saveEndpoints({ endpoints: [endpoint('Studio', 'abcd1234')] }),
    ).rejects.toThrow('token write failed')

    const endpoints = await import('@/server/repos/endpoints')
    const file = await endpoints.readEndpointFile()

    expect(file.endpoints).toEqual([])
  })

  it('keeps the old tokens when the endpoint write fails', async () => {
    await tokens.applyEndpointTokens({
      changes: [{ id: 'kept', token: 'old-token' }],
      removedIds: [],
    })

    repo.isApplyFailing = true

    await expect(
      service.saveEndpoints({ endpoints: [endpoint('Studio', 'new-token')] }),
    ).rejects.toThrow('endpoint write failed')

    expect(tokens.readTokenMap()).toEqual({ kept: 'old-token' })
  })

  it('keeps the endpoint file and token map from one save', async () => {
    repo.applyDelayMs = 20

    const ids = {
      a: '11111111-1111-4111-8111-111111111111',
      b: '22222222-2222-4222-8222-222222222222',
    }

    await Promise.all([
      service.saveEndpoints({ endpoints: [{ ...endpoint('A', 'token-a'), id: ids.a }] }),
      service.saveEndpoints({ endpoints: [{ ...endpoint('B', 'token-b'), id: ids.b }] }),
    ])

    const endpoints = await import('@/server/repos/endpoints')
    const file = await endpoints.readEndpointFile()
    const tokenMap = tokens.readTokenMap()

    const savedIds = file.endpoints.map((entry) => {
      return entry.id
    })

    const expectedTokens: Record<string, string> = {
      [ids.a]: 'token-a',
      [ids.b]: 'token-b',
    }

    for (const entry of file.endpoints) {
      expect(tokenMap[entry.id]).toBe(expectedTokens[entry.id])
    }

    for (const id of Object.keys(tokenMap)) {
      expect(savedIds).toContain(id)
    }
  })
})
