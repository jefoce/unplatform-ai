import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import type { GenerationRecord } from '@/core/schemas/generation-record'

import { storedRecord } from './helpers/stored-record'

const RECORDS = 4000
const WRITES = 100
const SPACING_MS = 50
const PRESET_IDS = ['wan-3.0', 'seedance-2.0', 'kling-3.0', 'veo-4.0', 'hailuo-3.0'] as const

function recordFor(id: string, index: number): GenerationRecord {
  const base = storedRecord(id)
  const presetId = PRESET_IDS[index % PRESET_IDS.length] ?? 'wan-3.0'

  return {
    ...base,
    createdAt: new Date(Date.UTC(2026, 0, 1) + index * 1000).toISOString(),
    input: { ...base.input, presetId },
    preset: { id: presetId, title: presetId, slug: presetId },
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function describeMs(ms: number): string {
  return ms.toFixed(1)
}

describe.skipIf(process.env.MEASURE_FACETS !== '1')('history facets at 4000 records', () => {
  it('measures the initial build and 100 incremental writes', { timeout: 180_000 }, async () => {
    const root = path.join(os.tmpdir(), `cf-history-facets-perf-${process.pid}-${Date.now()}`)
    const previousRoot = process.env.STORAGE_ROOT

    process.env.STORAGE_ROOT = root

    try {
      await fs.mkdir(root, { recursive: true })

      const generations = await import('@/server/repos/generations')
      const facets = await import('@/server/services/history-facets')

      const ids: string[] = []

      for (let index = 0; index < RECORDS; index += 1) {
        const id = randomUUID()

        ids.push(id)
        await generations.saveGeneration(recordFor(id, index))
      }

      const initialStart = performance.now()

      await facets.getHistoryFacets('video')

      const initialMs = performance.now() - initialStart
      let totalMs = 0

      for (let index = 0; index < WRITES; index += 1) {
        const id = ids[index % ids.length] ?? randomUUID()
        const start = performance.now()

        await generations.saveGeneration(recordFor(id, RECORDS + index))
        await facets.getHistoryFacets('video')

        totalMs += performance.now() - start
        await sleep(SPACING_MS)
      }

      const averageMs = totalMs / WRITES
      const latest = await facets.getHistoryFacets('video')

      console.log(
        `[facets-perf] ${RECORDS} records initial ${describeMs(initialMs)} ms, ` +
          `${WRITES} writes total ${describeMs(totalMs)} ms, average ${describeMs(averageMs)} ms/write`,
      )

      expect(latest.models.length).toBe(PRESET_IDS.length)
    } finally {
      if (previousRoot === undefined) {
        delete process.env.STORAGE_ROOT
      } else {
        process.env.STORAGE_ROOT = previousRoot
      }

      await fs.rm(root, { recursive: true, force: true })
    }
  })
})
