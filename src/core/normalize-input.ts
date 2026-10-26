import { clamp, isNil } from 'lodash-es'

import { durationLimitFor } from './duration-limits'
import { isNonEmptyString } from './guards'
import { MEDIA_KINDS, type MediaKindCounts } from './media-types'
import { aspectAllowed } from './output-size'
import { minDuration } from './presets'
import type { AspectChoice, ModelPreset, Resolution } from './presets/types'
import type { GenerationInput } from './schemas/generation-record'
import type { UploadsById } from './schemas/upload-item'
import type { FrameSlots } from './types'

/** Drop media belonging to the inactive tab. Returns a new object. */
export function inputForSubmit(input: GenerationInput): GenerationInput {
  if (input.tab !== 'frames') {
    return { ...input, frames: { start: null, end: null } }
  }

  const hasStart = isNonEmptyString(input.frames.start)
  const end = hasStart ? input.frames.end : null

  return { ...input, references: [], frames: { start: input.frames.start, end } }
}

interface ClampDurationParams {
  value: number
  preset: ModelPreset
  limit: number
}

/** Round to a whole second and clamp inside the reference limit. */
export const clampDuration = (params: ClampDurationParams): number => {
  const { value, preset, limit } = params

  return clamp(Math.round(value), minDuration(preset), limit)
}

interface NormalizeAspectParams {
  aspect: AspectChoice
  preset: ModelPreset
  resolution: Resolution
}

function normalizeAspect(params: NormalizeAspectParams): AspectChoice {
  const { aspect, preset, resolution } = params

  if (aspect === 'auto') {
    if (preset.autoAspectWithFrames) {
      return 'auto'
    }

    return preset.defaultAspectRatio
  }

  if (aspectAllowed({ preset, resolution, aspect })) {
    return aspect
  }

  return preset.defaultAspectRatio
}

function normalizeFrames(frames: FrameSlots, preset: ModelPreset): FrameSlots {
  if (!preset.frames.start || !isNonEmptyString(frames.start)) {
    return { start: null, end: null }
  }

  if (!preset.frames.end || !isNonEmptyString(frames.end)) {
    return { start: frames.start, end: null }
  }

  return { start: frames.start, end: frames.end }
}

const referencesDisabled = (preset: ModelPreset): boolean => {
  return MEDIA_KINDS.every((kind) => {
    return preset.references[kind] === 0
  })
}

interface TrimReferencesParams {
  ids: string[]
  preset: ModelPreset
  uploads: UploadsById
}

interface TrimReferencesResult {
  references: string[]
  notes: string[]
}

/** Keep references in order, dropping any past the per-kind limit. */
function trimReferences(params: TrimReferencesParams): TrimReferencesResult {
  const { ids, preset, uploads } = params
  const counts: MediaKindCounts = { image: 0, video: 0, audio: 0 }
  const removed: MediaKindCounts = { image: 0, video: 0, audio: 0 }

  const references = ids.filter((id) => {
    const kind = uploads[id]?.kind

    if (isNil(kind)) {
      return true
    } // unknown until uploads load, decided later

    if (counts[kind] < preset.references[kind]) {
      counts[kind] += 1

      return true
    }

    removed[kind] += 1

    return false
  })

  const notes = MEDIA_KINDS.filter((kind) => {
    return removed[kind] > 0
  }).map((kind) => {
    const count = removed[kind]
    const suffix = count === 1 ? '' : 's'

    return `Removed ${count} ${kind} reference${suffix}`
  })

  return { references, notes }
}

interface NormalizeForPresetParams {
  input: GenerationInput
  preset: ModelPreset
  uploads?: UploadsById
}

interface NormalizedInput {
  input: GenerationInput
  notes: string[]
}

/** Fit a draft input to a preset without mutating it. Notes list every change. */
export function normalizeForPreset(params: NormalizeForPresetParams): NormalizedInput {
  const { input, preset, uploads = {} } = params
  const notes: string[] = []
  let tab = input.tab
  let references = input.references

  if (referencesDisabled(preset)) {
    if (tab === 'references') {
      tab = 'frames'
      notes.push(`References not supported by ${preset.title}`)
    }
  } else {
    const trimmed = trimReferences({ ids: input.references, preset, uploads })

    references = trimmed.references
    notes.push(...trimmed.notes)
  }

  let activeReferences: string[] = []

  if (tab === 'references') {
    activeReferences = references
  }

  const limit = durationLimitFor({ references: activeReferences, uploads, preset })
  const duration = clampDuration({ value: input.duration, preset, limit })

  if (duration !== input.duration) {
    notes.push(`Duration set to ${duration}s`)
  }

  let resolution = input.resolution

  if (!preset.resolutions.includes(resolution)) {
    resolution = preset.defaultResolution
    notes.push(`Resolution set to ${resolution}`)
  }

  const aspectRatio = normalizeAspect({ aspect: input.aspectRatio, preset, resolution })

  if (aspectRatio !== input.aspectRatio && input.aspectRatio !== 'auto') {
    notes.push(`Aspect set to ${aspectRatio}`)
  }

  const hasAudio = preset.audio.supported ? input.audio : false

  return {
    input: {
      ...input,
      presetId: preset.id,
      tab,
      duration,
      resolution,
      aspectRatio,
      audio: hasAudio,
      frames: normalizeFrames(input.frames, preset),
      references,
    },
    notes,
  }
}
