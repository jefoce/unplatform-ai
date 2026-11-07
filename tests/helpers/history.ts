import { act } from '@testing-library/react'

import { useSelectionStore } from '@/features/history/selection/selection-store'
import { getSnapshot, release } from '@/features/player/player-slots'

import type { GenerationRecord, JobStatus } from '../../src/core/schemas/generation-record'
import { type VideoGridItem, videoItem } from '../../src/lib/feed/output-items'
import { required } from './required'

export class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

export interface RecordOverrides {
  status?: JobStatus
  error?: string
  favorite?: boolean
  provider?: GenerationRecord['provider']
  submit?: GenerationRecord['submit']
  output?: GenerationRecord['output']
  previewPending?: boolean
  updatedAt?: string
}

export function record(id: string, overrides: RecordOverrides = {}): GenerationRecord {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'completed',
    provider: 'openrouter',
    input: {
      presetId: 'seedance-2.0',
      tab: 'references',
      prompt: `Prompt ${id}`,
      audio: true,
      duration: 4,
      aspectRatio: '16:9',
      resolution: '1080p',
      frames: { start: null, end: null },
      references: [],
      seed: null,
    },
    preset: { id: 'seedance-2.0', title: 'Seedance', slug: 'seedance' },
    inputsSnapshot: {},
    seedUsed: 1,
    favorite: false,
    cost: {
      currency: 'USD',
      pricePerSec: 0,
      priceSource: 'mock',
      estimatedUsd: 0,
      actualUsd: 0,
      isByok: false,
      billed: true,
    },
    output: { video: `${id}.mp4`, preview: `${id}.preview.png` },
    ...overrides,
  }
}

/** Video record fixture wrapped as a grid item. */
export function item(id: string, overrides: RecordOverrides = {}): VideoGridItem {
  return videoItem(record(id, overrides))
}

/** Wraps an existing record as a grid item. */
export function itemOf(record: GenerationRecord): VideoGridItem {
  return videoItem(record)
}

/** Wraps a record list as grid items. */
export function items(records: GenerationRecord[]): VideoGridItem[] {
  return records.map((entry) => {
    return videoItem(entry)
  })
}

export const handleNoop = () => {}

export function releaseAllSlots(): void {
  for (const id of getSnapshot()) {
    release(id)
  }
}

export const ids = () => {
  return [...useSelectionStore.getState().ids]
}

export const setSelection = (list: string[]) => {
  act(() => {
    useSelectionStore.getState().setMany(list, true)
  })
}

export const setOrder = (list: string[]) => {
  useSelectionStore.getState().setOrder(list)
}

export function tile(container: HTMLElement, id: string): HTMLElement {
  return required(
    container.querySelector<HTMLElement>(`#history-item-${id} [role="button"]`),
    `tile ${id}`,
  )
}
