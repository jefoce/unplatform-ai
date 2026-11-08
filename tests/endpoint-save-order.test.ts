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
  return { isApplyFailing: false, tokenSeenOnApply: null as string | null }
})

const tokenState = vi.hoisted(() => {
  return { isWriteFailing: false }
})

vi.mock('@/server/repos/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof EndpointRepo>()

  return {
    ...actual,
    applyEndpoints: async (params: EndpointRepo.ApplyEndpointsParams) => {
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
})
