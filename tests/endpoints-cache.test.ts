import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type * as EndpointsRepo from '@/server/repos/endpoints'
import type * as EndpointsService from '@/server/services/endpoints'

const ROOT = path.join(os.tmpdir(), `cf-endpoints-cache-${process.pid}-${Date.now()}`)
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

const LAST_HEALTH = {
  protocol: 1,
  serverVersion: '0.43.0',
  maxRunning: 2,
  lanAllowed: true,
  authRequired: false,
  maxUploadBytes: 100,
  checkedAt: '2024-01-01T00:00:00.000Z',
}

process.env.STORAGE_ROOT = ROOT

let service: typeof EndpointsService
let repo: typeof EndpointsRepo

function endpoint(): EndpointsService.EndpointInput {
  return {
    id: null,
    label: 'Studio',
    badge: null,
    baseUrl: 'http://127.0.0.1:8188',
    enabled: true,
    pricing: { mode: 'model', usd: 0 },
    instanceId: null,
    lastHealth: null,
  }
}

function endpointInput(
  entry: EndpointsService.EndpointOverviewEntry,
): EndpointsService.EndpointInput {
  return {
    id: entry.id,
    label: entry.label,
    badge: entry.badge,
    baseUrl: entry.baseUrl,
    enabled: entry.enabled,
    pricing: entry.pricing,
    instanceId: entry.instanceId,
    lastHealth: entry.lastHealth,
  }
}

async function saveStudio(): Promise<EndpointsService.EndpointOverviewEntry> {
  const saved = await service.saveEndpoints({ endpoints: [endpoint()] })
  const entry = saved.endpoints[0]

  if (!entry) {
    throw new Error('Missing saved endpoint')
  }

  return entry
}

async function writeCache(id: string): Promise<string> {
  const cacheFile = repo.endpointModelsFile(id)

  await fs.mkdir(path.dirname(cacheFile), { recursive: true })
  await fs.writeFile(cacheFile, JSON.stringify({ video: [{}], image: [{}, {}] }))

  return cacheFile
}

beforeAll(async () => {
  const secrets = await import('@/server/secrets')

  secrets.__setSecretsBackendForTests((await import('./helpers/secrets')).memoryBackend())
  await secrets.secretsReady()

  service = await import('@/server/services/endpoints')
  repo = await import('@/server/repos/endpoints')
})

beforeEach(async () => {
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

describe('endpoint cache refresh', () => {
  it('keeps the cache file and counts for an unchanged endpoint', async () => {
    const entry = await saveStudio()
    const cacheFile = await writeCache(entry.id)

    const saved = await service.saveEndpoints({ endpoints: [endpointInput(entry)] })

    await expect(fs.stat(cacheFile)).resolves.toBeDefined()
    expect(saved.endpoints[0]?.videoCount).toBe(1)
    expect(saved.endpoints[0]?.imageCount).toBe(2)
  })

  it('removes the cache file when the base URL changes', async () => {
    const entry = await saveStudio()
    const cacheFile = await writeCache(entry.id)

    await service.saveEndpoints({
      endpoints: [{ ...endpointInput(entry), baseUrl: 'http://127.0.0.1:9999' }],
    })

    await expect(fs.stat(cacheFile)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('removes the cache file when a token changes', async () => {
    const entry = await saveStudio()
    const cacheFile = await writeCache(entry.id)

    await service.saveEndpoints({ endpoints: [{ ...endpointInput(entry), token: 'abcd1234' }] })

    await expect(fs.stat(cacheFile)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('keeps the cache file when a fresh test covers an edited endpoint', async () => {
    const entry = await saveStudio()
    const cacheFile = await writeCache(entry.id)

    await service.saveEndpoints({
      endpoints: [
        {
          ...endpointInput(entry),
          baseUrl: 'http://127.0.0.1:9999',
          lastHealth: { ...LAST_HEALTH, checkedAt: '2024-06-01T00:00:00.000Z' },
        },
      ],
    })

    await expect(fs.stat(cacheFile)).resolves.toBeDefined()
  })

  it('has no cache file for a new endpoint', async () => {
    const entry = await saveStudio()

    await expect(fs.stat(repo.endpointModelsFile(entry.id))).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it('removes the cache file of a deleted endpoint', async () => {
    const entry = await saveStudio()
    const cacheFile = await writeCache(entry.id)

    await service.saveEndpoints({ endpoints: [] })

    await expect(fs.stat(cacheFile)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
