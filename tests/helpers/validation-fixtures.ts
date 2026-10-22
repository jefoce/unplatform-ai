import { getPreset } from '@/core/presets'
import type { GenerationInput, MediaKind, UploadItem } from '@/core/types'

export const preset = getPreset('wan-3.0')
export const MB = 1024 * 1024

const EXT_BY_KIND = { image: '.png', video: '.mp4', audio: '.mp3' } satisfies Record<
  MediaKind,
  string
>
const MIME_BY_KIND = {
  image: 'image/png',
  video: 'video/mp4',
  audio: 'audio/mpeg',
} satisfies Record<MediaKind, string>

export function upload(
  id: string,
  kind: MediaKind,
  overrides: Partial<UploadItem> = {},
): UploadItem {
  const ext = EXT_BY_KIND[kind]
  const mime = MIME_BY_KIND[kind]

  return {
    id,
    source: 'file',
    kind,
    mime,
    ext,
    originalName: `${id}${ext}`,
    sizeBytes: 1024,
    createdAt: '2026-10-20T00:00:00.000Z',
    ...overrides,
  }
}

export function input(overrides: Partial<GenerationInput> = {}): GenerationInput {
  return {
    presetId: preset.id,
    tab: 'references',
    prompt: 'A cat',
    audio: true,
    duration: 5,
    aspectRatio: '16:9',
    resolution: '1080p',
    frames: { start: null, end: null },
    references: [],
    seed: null,
    ...overrides,
  }
}

export function uploadsOf(...items: UploadItem[]): Record<string, UploadItem> {
  return Object.fromEntries(items.map((item) => [item.id, item]))
}
