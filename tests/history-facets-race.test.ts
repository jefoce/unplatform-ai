import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type * as GenerationsRepoModule from '@/server/repos/generations'
import type * as FacetsModule from '@/server/services/history-facets'

import type { GenerationRecord } from '../src/core/schemas/generation-record'
import { storedRecord } from './helpers/stored-record'

const ROOT = path.join(os.tmpdir(), `cf-history-facets-race-${process.pid}-${Date.now()}`)
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

vi.mock('@/server/session', () => {
  return {
    hasSession: () => {
      return true
    },
  }
})

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void

  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve
  })

  return { promise, resolve }
}

let generations: typeof GenerationsRepoModule
let facets: typeof FacetsModule

beforeAll(async () => {
  await fs.mkdir(ROOT, { recursive: true })

  generations = await import('@/server/repos/generations')

  vi.spyOn(generations, 'listGenerations')

  facets = await import('@/server/services/history-facets')
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

describe('history facets initial load', () => {
  it('keeps a write that lands while the initial list is pending', async () => {
    const list = vi.mocked(generations.listGenerations)
    const deferred = createDeferred<GenerationRecord[]>()

    list.mockReturnValueOnce(deferred.promise)

    const pendingFacets = facets.getHistoryFacets('video')
    const id = randomUUID()

    await generations.saveGeneration(storedRecord(id))

    deferred.resolve([])

    const result = await pendingFacets

    expect(
      result.models.map((model) => {
        return model.presetId
      }),
    ).toEqual(['seedance-2.0'])
  })
})
