import { randomUUID } from 'node:crypto'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { ImageRecord } from '@/core/schemas/image-record'
import { STATUS_HELP, statusHelpKey } from '@/core/status-help'
import { imageStatusView } from '@/features/history/status/status-view'
import { imageItems } from '@/lib/feed/output-items'

import { storedRecord } from './stored-record'

/** Consecutive equal labels collapse to one stage change. */
function stageChanges(labels: string[]): string[] {
  return labels.filter((label, index) => {
    return index === 0 || label !== labels[index - 1]
  })
}

/** Labels recorded for each persisted video record. */
export function videoLabels(records: GenerationRecord[]): string[] {
  return stageChanges(
    records.map((record) => {
      return STATUS_HELP[statusHelpKey(record)].label
    }),
  )
}

/** Pending output shows Generating, a saved output shows Completed. */
function imageLabel(record: ImageRecord): string {
  const items = imageItems(record)

  const item =
    items.find((entry) => {
      return entry.output?.status === 'pending'
    }) ?? items[0]

  if (!item) {
    return STATUS_HELP.processing.label
  }

  return imageStatusView(item).label
}

/** Labels recorded for each persisted image record. */
export function imageLabels(records: ImageRecord[]): string[] {
  return stageChanges(records.map(imageLabel))
}

function now(): string {
  return new Date().toISOString()
}

/** Submitting video record with the given reference ids. */
export function videoRecord(references: string[]): GenerationRecord {
  return storedRecord(randomUUID(), {
    createdAt: now(),
    updatedAt: now(),
    status: 'submitting',
    submit: { stage: 'grace', notBefore: '2020-01-01T00:00:00.000Z' },
    inputsSnapshot: {},
    input: {
      presetId: 'seedance-2.0',
      tab: 'references',
      prompt: 'A cat',
      audio: false,
      duration: 4,
      aspectRatio: '16:9',
      resolution: '720p',
      frames: { start: null, end: null },
      references,
      seed: null,
    },
  })
}

/** Submitting image record with one pending output. */
export function imageRecord(): ImageRecord {
  return {
    id: randomUUID(),
    createdAt: now(),
    updatedAt: now(),
    status: 'submitting',
    provider: 'openrouter',
    preset: { id: 'gemini-3.1-flash-image', title: 'Nano Banana 2', slug: 'gemini' },
    input: {
      presetId: 'gemini-3.1-flash-image',
      prompt: 'a cat',
      count: 1,
      aspectRatio: '1:1',
      resolution: '1K',
      quality: null,
      background: null,
      references: [],
      seed: null,
    },
    submit: { stage: 'grace', notBefore: '2020-01-01T00:00:00.000Z' },
    outputs: [{ id: randomUUID(), index: 0, status: 'pending' }],
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd: 0,
      actualUsd: null,
      priceSource: 'mock',
      billed: null,
    },
  }
}
