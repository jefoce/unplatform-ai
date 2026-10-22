import { act } from '@testing-library/react'

import type { GenerationRecord, JobStatus } from '@/core/types'
import { useSelectionStore } from '@/features/history/selection-store'

import { required } from './required'

export class Observer {
  observe() {}
  disconnect() {}
}

export interface RecordOverrides {
  status?: JobStatus
  error?: string
  favorite?: boolean
  submit?: GenerationRecord['submit']
}

export function record(id: string, overrides: RecordOverrides = {}): GenerationRecord {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'completed',
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

export const handleNoop = () => {}
export const ids = () => [...useSelectionStore.getState().ids]
export const setSelection = (list: string[]) =>
  act(() => useSelectionStore.getState().setMany(list, true))
export const setOrder = (list: string[]) => useSelectionStore.getState().setOrder(list)

export function tile(container: HTMLElement, id: string): HTMLElement {
  return required(
    container.querySelector<HTMLElement>(`#history-item-${id} [role="button"]`),
    `tile ${id}`,
  )
}
