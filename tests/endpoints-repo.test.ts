import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type * as EndpointsRepo from '@/server/repos/endpoints'

const ROOT = path.join(os.tmpdir(), `cf-endpoints-repo-${process.pid}-${Date.now()}`)
const DATA = path.join(ROOT, 'data')
const FILE = path.join(DATA, 'endpoints.json')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

let repo: typeof EndpointsRepo

beforeAll(async () => {
  repo = await import('@/server/repos/endpoints')
})

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(DATA, { recursive: true })
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

function entry(label: string): EndpointsRepo.EndpointEntry {
  return {
    label,
    baseUrl: 'http://127.0.0.1:8188',
    enabled: true,
    pricing: { mode: 'model', usd: 0 },
    instanceId: null,
    lastHealth: null,
  }
}

async function readFile(): Promise<unknown> {
  return JSON.parse(await fs.readFile(FILE, 'utf8')) as unknown
}

describe('base URL normalization', () => {
  it('keeps scheme, host and port and strips a path', () => {
    expect(repo.normalizeBaseUrl('http://127.0.0.1:8188/upai')).toBe('http://127.0.0.1:8188')
    expect(repo.normalizeBaseUrl('http://127.0.0.1:8188/upai/api/v1')).toBe('http://127.0.0.1:8188')

    expect(repo.normalizeBaseUrl('  https://studio.local:8443/  ')).toBe(
      'https://studio.local:8443',
    )
  })

  it('adds http when the scheme is missing', () => {
    expect(repo.normalizeBaseUrl('127.0.0.1:8188')).toBe('http://127.0.0.1:8188')
  })

  it('rejects an empty URL and a non-http scheme', () => {
    expect(() => {
      return repo.normalizeBaseUrl('  ')
    }).toThrow('Endpoint URL is required')

    expect(() => {
      return repo.normalizeBaseUrl('ftp://127.0.0.1:8188')
    }).toThrow('Endpoint URL must use http or https')
  })
})

describe('badge allocation', () => {
  it('never reuses a deleted number', async () => {
    const first = await repo.applyEndpoints({ entries: [entry('One')] })
    const one = first.file.endpoints[0]

    const second = await repo.applyEndpoints({
      entries: [one ?? entry('One'), entry('Two')],
    })

    expect(one?.badge).toBe('CU1')
    expect(second.file.endpoints[1]?.badge).toBe('CU2')

    const keptOne = second.file.endpoints[0] ?? entry('One')
    const removed = await repo.applyEndpoints({ entries: [keptOne] })

    expect(removed.removedIds).toEqual([second.file.endpoints[1]?.id])

    const third = await repo.applyEndpoints({
      entries: [keptOne, entry('Three')],
    })

    expect(third.file.endpoints[1]?.badge).toBe('CU3')
    expect(third.file.badgeCounter).toBe(3)
  })

  it('advances the counter for a custom badge after it is deleted', async () => {
    const saved = await repo.applyEndpoints({ entries: [{ ...entry('One'), badge: 'CU9' }] })

    expect(saved.file.endpoints[0]?.badge).toBe('CU9')
    expect(saved.file.badgeCounter).toBe(9)

    const service = await import('@/server/services/endpoints')

    await repo.applyEndpoints({ entries: [] })

    expect((await service.getEndpointOverview()).nextBadge).toBe('CU10')

    const next = await repo.applyEndpoints({ entries: [entry('Two')] })

    expect(next.file.endpoints[0]?.badge).toBe('CU10')
    expect(next.file.badgeCounter).toBe(10)
  })

  it('uppercases a typed badge and rejects a duplicate', async () => {
    const saved = await repo.applyEndpoints({
      entries: [
        { ...entry('One'), badge: 'abcd' },
        { ...entry('Two'), badge: 'AB12' },
      ],
    })

    expect(saved.file.endpoints[0]?.badge).toBe('ABCD')

    const savedBadge = await repo.applyEndpoints({
      entries: [{ ...entry('One'), badge: 'ab12' }, entry('Two')],
    })

    expect(savedBadge.file.endpoints[0]?.badge).toBe('AB12')

    await expect(
      repo.applyEndpoints({
        entries: [
          { ...entry('One'), badge: 'AB12' },
          { ...entry('Two'), badge: 'AB12' },
        ],
      }),
    ).rejects.toMatchObject({ status: 400, message: 'Badge AB12 is already used' })
  })

  it('assigns ids and keeps the request order', async () => {
    const saved = await repo.applyEndpoints({ entries: [entry('One'), entry('Two')] })

    expect(
      saved.file.endpoints.map((endpoint) => {
        return endpoint.label
      }),
    ).toEqual(['One', 'Two'])

    expect(saved.file.endpoints[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })
})

describe('file writes', () => {
  it('writes one valid file and leaves no temp file', async () => {
    const saved = await repo.applyEndpoints({ entries: [entry('One')] })
    const names = await fs.readdir(DATA)

    expect(await readFile()).toEqual(saved.file)
    expect(names).toEqual(['endpoints.json'])
  })

  it('refuses to overwrite a corrupted file', async () => {
    const corrupted = '[{"id": 42}]'

    await fs.writeFile(FILE, corrupted)

    await expect(repo.applyEndpoints({ entries: [entry('One')] })).rejects.toMatchObject({
      status: 500,
    })

    expect(await fs.readFile(FILE, 'utf8')).toBe(corrupted)
  })
})
