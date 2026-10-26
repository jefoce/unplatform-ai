import type { AspectChoice, Resolution } from '@/core/presets/types'
import type { GenerationRecord, GeneratorTab, JobStatus } from '@/core/schemas/generation-record'

export interface RecordOptions {
  id: string
  createdAt: string
  status?: JobStatus
  favorite?: boolean
  prompt?: string
  title?: string
  presetId?: string
  tab?: GeneratorTab
  resolution?: Resolution
  aspect?: AspectChoice
  audio?: boolean
  frames?: GenerationRecord['input']['frames']
  references?: string[]
}

export function record(options: RecordOptions): GenerationRecord {
  return {
    id: options.id,
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
    status: options.status ?? 'completed',
    provider: 'openrouter',
    input: inputFor(options),
    preset: { id: 'wan-3.0', title: options.title ?? 'Wan 3.0', slug: 'alibaba/wan-3.0' },
    inputsSnapshot: {},
    seedUsed: null,
    favorite: options.favorite ?? false,
    cost: {
      currency: 'USD',
      pricePerSec: 0.2,
      priceSource: 'fallback',
      estimatedUsd: 1,
      actualUsd: null,
      isByok: null,
      billed: null,
    },
  }
}

function inputFor(options: RecordOptions): GenerationRecord['input'] {
  return {
    presetId: options.presetId ?? 'wan-3.0',
    tab: options.tab ?? 'references',
    prompt: options.prompt ?? 'A cat',
    audio: options.audio ?? true,
    duration: 5,
    aspectRatio: options.aspect ?? '16:9',
    resolution: options.resolution ?? '1080p',
    frames: options.frames ?? { start: null, end: null },
    references: options.references ?? [],
    seed: null,
  }
}

export function at(minute: number): string {
  return `2026-10-20T00:${String(minute).padStart(2, '0')}:00.000Z`
}

export const records = [
  record({ id: 'a', createdAt: at(1), prompt: 'A Red Fox', favorite: true }),
  record({ id: 'b', createdAt: at(2), prompt: 'Blue whale', status: 'pending', title: 'Other' }),
  record({ id: 'c', createdAt: at(3), status: 'failed' }),
  record({ id: 'd', createdAt: at(4), status: 'cancelled' }),
  record({ id: 'e', createdAt: at(5), status: 'expired' }),
  record({ id: 'f', createdAt: at(6), status: 'in_progress' }),
  record({ id: 'g', createdAt: at(7), status: 'submitting' }),
]
