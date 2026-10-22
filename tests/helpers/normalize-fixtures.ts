import type { ModelPreset } from '@/core/presets'
import { getPreset } from '@/core/presets'
import type { GenerationInput, MediaKind, UploadItem } from '@/core/types'

export const wan = getPreset('wan-3.0')

export const withPreset = (overrides: Partial<ModelPreset>): ModelPreset => ({
  ...wan,
  ...overrides,
})

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

export const uploadsOf = (...items: UploadItem[]): Record<string, UploadItem> =>
  Object.fromEntries(items.map((item) => [item.id, item]))
