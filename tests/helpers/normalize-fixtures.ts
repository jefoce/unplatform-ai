import type { MediaKind } from '@/core/media-types'
import { getPreset } from '@/core/presets'
import type { ModelPreset } from '@/core/presets/types'
import type { GenerationInput } from '@/core/schemas/generation-record'
import { type UploadItem, type UploadsById } from '@/core/schemas/upload-item'

export const wan = getPreset('wan-3.0')

export const withPreset = (overrides: Partial<ModelPreset>): ModelPreset => {
  return {
    ...wan,
    ...overrides,
  }
}

export function input(overrides: Partial<GenerationInput> = {}): GenerationInput {
  return {
    presetId: 'wan-3.0',
    tab: 'references',
    prompt: 'A cat',
    audio: true,
    duration: 5,
    aspectRatio: '16:9',
    resolution: '1080p',
    frames: { start: 'start', end: 'end' },
    references: ['ref'],
    seed: 7,
    ...overrides,
  }
}

export function upload(
  id: string,
  kind: MediaKind,
  overrides: Partial<UploadItem> = {},
): UploadItem {
  return {
    id,
    source: 'file',
    kind,
    mime: '',
    ext: '',
    originalName: id,
    sizeBytes: 0,
    createdAt: '2026-10-20T00:00:00.000Z',
    ...overrides,
  }
}

export const uploadsOf = (...items: UploadItem[]): UploadsById => {
  return Object.fromEntries(
    items.map((item) => {
      return [item.id, item]
    }),
  )
}
