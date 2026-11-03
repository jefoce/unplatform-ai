import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CallOutcome } from '@/server/jobs/image-calls'

import type { ImageRecord } from '../src/core/schemas/image-record'

const ROOT = path.join(os.tmpdir(), `cf-image-cost-${process.pid}-${Date.now()}`)
const IMAGES = path.join(ROOT, 'images')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

interface ImagesRepo {
  getImage: (id: string) => Promise<ImageRecord | null>
  saveImage: (record: ImageRecord) => Promise<ImageRecord>
  listImages: () => Promise<ImageRecord[]>
}

interface OutputsModule {
  saveOutcome: (params: {
    record: ImageRecord
    outcome: CallOutcome
    resolved: CallOutcome[]
  }) => Promise<void>
  finishImage: (params: { id: string; resolved: CallOutcome[] }) => Promise<void>
}

let repo: ImagesRepo
let outputs: OutputsModule
let testIndex = 0

beforeAll(async () => {
  repo = await import('@/server/repos/images')
  outputs = await import('@/server/jobs/image-outputs')
})

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(IMAGES, { recursive: true })

  testIndex += 1
  const stamp = new Date(Date.now() + testIndex * 1000)

  await fs.utimes(IMAGES, stamp, stamp)
  await repo.listImages()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

function record(estimatedUsd: number): ImageRecord {
  const now = '2026-01-01T00:00:00.000Z'

  return {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'saving',
    provider: 'openrouter',
    preset: { id: 'gemini-3.1-flash-image', title: 'Nano Banana 2', slug: 'gemini' },
    input: {
      presetId: 'gemini-3.1-flash-image',
      prompt: 'a cat',
      count: 2,
      aspectRatio: '1:1',
      resolution: '1K',
      quality: null,
      background: null,
      references: [],
      seed: null,
    },
    outputs: Array.from({ length: 2 }, (_, index) => {
      return { id: randomUUID(), index, status: 'pending' as const }
    }),
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd,
      actualUsd: null,
      priceSource: 'mock',
      billed: null,
    },
  }
}

function outcome(costUsd: number): CallOutcome {
  return { start: 0, count: 2, items: [], costUsd, error: null, isUncertain: false }
}

function uncertainOutcome(): CallOutcome {
  return {
    start: 2,
    count: 1,
    items: [],
    costUsd: null,
    error: 'Request timed out',
    isUncertain: true,
  }
}

describe('image cost warning', () => {
  it('logs once when the actual cost is above 1.5 times the estimate', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const saved = await repo.saveImage(record(1))

    await outputs.saveOutcome({ record: saved, outcome: outcome(2), resolved: [outcome(2)] })
    await outputs.finishImage({ id: saved.id, resolved: [outcome(2)] })
    await outputs.finishImage({ id: saved.id, resolved: [outcome(2)] })

    expect(warn).toHaveBeenCalledTimes(1)

    expect(warn).toHaveBeenCalledWith(
      '[pricing] image actual 2.0x estimate: gemini-3.1-flash-image est 1 actual 2',
    )
  })

  it('stays quiet at exactly 1.5 times the estimate', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const saved = await repo.saveImage(record(2))

    await outputs.saveOutcome({ record: saved, outcome: outcome(3), resolved: [outcome(3)] })
    await outputs.finishImage({ id: saved.id, resolved: [outcome(3)] })

    expect(warn).not.toHaveBeenCalled()
  })

  it('stays quiet in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const saved = await repo.saveImage(record(1))

    await outputs.saveOutcome({ record: saved, outcome: outcome(2), resolved: [outcome(2)] })
    await outputs.finishImage({ id: saved.id, resolved: [outcome(2)] })
    await outputs.finishImage({ id: saved.id, resolved: [outcome(2)] })

    expect(warn).not.toHaveBeenCalled()
  })
})

describe('uncertain image cost', () => {
  it('excludes the uncertain call and flags a possible charge', async () => {
    const saved = await repo.saveImage(record(1))
    const success = outcome(0.04)
    const uncertain = uncertainOutcome()
    const resolved = [success, uncertain]

    await outputs.saveOutcome({ record: saved, outcome: success, resolved })
    await outputs.finishImage({ id: saved.id, resolved })

    const stored = await repo.getImage(saved.id)

    expect(stored?.cost.actualUsd).toBeCloseTo(0.04)
    expect(stored?.cost.mayHaveBeenCharged).toBe(true)
  })

  it('leaves the actual cost unknown when only an uncertain call resolved', async () => {
    const saved = await repo.saveImage(record(1))
    const uncertain = uncertainOutcome()

    await outputs.saveOutcome({ record: saved, outcome: uncertain, resolved: [uncertain] })
    await outputs.finishImage({ id: saved.id, resolved: [uncertain] })

    const stored = await repo.getImage(saved.id)

    expect(stored?.cost.actualUsd).toBeNull()
    expect(stored?.cost.mayHaveBeenCharged).toBe(true)
  })
})
