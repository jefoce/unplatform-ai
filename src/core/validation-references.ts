import { isNil, sumBy } from 'lodash-es'

import { maxDurationFor } from './duration-limits'
import { KIND_TITLE, MEDIA_KINDS } from './media-kinds'
import type { ModelPreset } from './presets'
import { missingSlots, referenceSlots, type SlotCounts } from './prompt-tokens'
import { resolveTransport } from './transport'
import type { GenerationInput, MediaKind, UploadItem } from './types'
import { checkReferenceLimits, seconds } from './validation-media'
import type {
  RuleResult,
  ValidateFramesParams,
  ValidateWithContextParams,
  ValidationContext,
  ValidationIssue,
} from './validation-types'

const REMOTE_REF_KINDS: readonly MediaKind[] = ['video', 'audio']

interface CheckRefDurationsParams {
  kind: 'video' | 'audio'
  items: UploadItem[]
  preset: ModelPreset
  errors: string[]
}

interface CollectReferencesParams {
  input: GenerationInput
  uploads: Record<string, UploadItem>
  preset: ModelPreset
  errors: string[]
}

const collectReferences = (params: CollectReferencesParams): UploadItem[] => {
  const { input, uploads, preset, errors } = params
  const attached: UploadItem[] = []

  for (const id of input.references) {
    const upload = uploads[id]

    if (isNil(upload)) {
      errors.push('Reference file not found')
      continue
    }

    attached.push(upload)

    if (upload.missing === true) {
      errors.push(`File missing: ${upload.originalName}`)
      continue
    }

    checkReferenceLimits({ upload, preset, errors })
  }

  return attached
}

interface CheckReferenceCountsParams {
  counts: SlotCounts
  preset: ModelPreset
  errors: string[]
}

const checkReferenceCounts = (params: CheckReferenceCountsParams): void => {
  const { counts, preset, errors } = params

  for (const kind of MEDIA_KINDS) {
    if (counts[kind] > preset.references[kind])
      errors.push(`Too many ${kind}s (${counts[kind]}, max ${preset.references[kind]})`)
  }
}

interface CheckRemoteTransportParams extends CheckReferenceCountsParams {
  ctx: ValidationContext
}

const checkRemoteTransport = (params: CheckRemoteTransportParams): void => {
  const { counts, preset, ctx, errors } = params

  for (const kind of REMOTE_REF_KINDS) {
    // Unknown while loading, so no warning until the status resolves.
    if (counts[kind] === 0 || ctx.remoteConfigured !== false) continue

    if (resolveTransport({ preset, kind, remoteConfigured: false }) !== 'url') continue

    errors.push(
      `${KIND_TITLE[kind]} references for ${preset.title} need cloud storage (R2) configured`,
    )
  }
}

interface CheckAudioVisualParams {
  audio: UploadItem[]
  counts: SlotCounts
  preset: ModelPreset
  errors: string[]
}

const checkAudioVisual = (params: CheckAudioVisualParams): void => {
  const { audio, counts, preset, errors } = params
  const refs = preset.references

  if (refs.audioNeedsVisual !== true || audio.length === 0) return
  if (counts.image > 0 || counts.video > 0) return

  errors.push('Audio references need at least one image or video reference')
}

interface CheckDurationTotalsParams {
  videos: UploadItem[]
  audio: UploadItem[]
  preset: ModelPreset
  errors: string[]
}

const totalDuration = (items: UploadItem[]): number => sumBy(items, (item) => item.durationSec ?? 0)

const checkDurationTotals = (
  params: CheckDurationTotalsParams,
): { videoTotal: number; audioTotal: number } => {
  const { videos, audio, preset, errors } = params
  const videoTotal = totalDuration(videos)
  const audioTotal = totalDuration(audio)

  if (videoTotal > preset.references.videoTotalSec)
    errors.push(
      `Video references are too long in total (${seconds(videoTotal)}s, max ${preset.references.videoTotalSec}s)`,
    )

  if (audioTotal > preset.references.audioTotalSec)
    errors.push(
      `Audio references are too long in total (${seconds(audioTotal)}s, max ${preset.references.audioTotalSec}s)`,
    )

  return { videoTotal, audioTotal }
}

interface CheckMaxInputParams extends ValidateFramesParams {
  videos: UploadItem[]
  videoTotal: number
  errors: string[]
}

const checkMaxInputPlusOutput = (params: CheckMaxInputParams): void => {
  const { input, uploads, preset, videos, videoTotal, errors } = params

  if (isNil(preset.maxInputPlusOutputSec) || videos.length === 0) return

  const limit = maxDurationFor({ input, uploads, preset })

  if (input.duration > limit)
    errors.push(
      `Max ${limit}s: reference videos are ${seconds(videoTotal)}s in total, limit ${preset.maxInputPlusOutputSec}s`,
    )
}

interface DurationLimits {
  min?: number
  max?: number
}

const durationLimits = (kind: 'video' | 'audio', preset: ModelPreset): DurationLimits => {
  const refs = preset.references

  if (kind === 'video') return { min: refs.videoMinSec, max: refs.videoMaxSec }
  return { min: refs.audioMinSec, max: refs.audioMaxSec }
}

interface CheckItemDurationParams {
  duration: number | undefined
  min: number | undefined
  max: number | undefined
  label: string
  errors: string[]
}

const checkItemDuration = (params: CheckItemDurationParams): void => {
  const { duration, min, max, label, errors } = params

  if (isNil(duration)) return

  if (!isNil(min) && duration < min) errors.push(`${label} is ${seconds(duration)}s, min ${min}s`)

  if (!isNil(max) && duration > max) errors.push(`${label} is ${seconds(duration)}s, max ${max}s`)
}

function checkRefDurations(params: CheckRefDurationsParams): void {
  const { kind, items, preset, errors } = params
  const { min, max } = durationLimits(kind, preset)

  if (isNil(min) && isNil(max)) return

  const title = kind === 'video' ? 'Video' : 'Audio'

  for (const [index, item] of items.entries()) {
    checkItemDuration({
      duration: item.durationSec,
      min,
      max,
      label: `${title} ${index + 1}`,
      errors,
    })
  }
}

export function validateReferences(params: ValidateWithContextParams): RuleResult {
  const { input, uploads, preset, ctx } = params
  const errors: string[] = []
  const warnings: ValidationIssue[] = []

  if (input.tab !== 'references') return { errors, warnings }

  if (MEDIA_KINDS.every((kind) => preset.references[kind] === 0)) {
    errors.push(`References are not supported by ${preset.title}`)

    return { errors, warnings }
  }

  const attached = collectReferences({ input, uploads, preset, errors })
  const { counts } = referenceSlots(input.references, (id) => uploads[id]?.kind)
  const videos = attached.filter((upload) => upload.kind === 'video')
  const audio = attached.filter((upload) => upload.kind === 'audio')

  checkReferenceCounts({ counts, preset, errors })
  checkRemoteTransport({ counts, preset, ctx, errors })
  checkAudioVisual({ audio, counts, preset, errors })
  checkRefDurations({ kind: 'video', items: videos, preset, errors })
  checkRefDurations({ kind: 'audio', items: audio, preset, errors })

  const { videoTotal } = checkDurationTotals({ videos, audio, preset, errors })

  checkMaxInputPlusOutput({ input, uploads, preset, videos, videoTotal, errors })

  for (const slot of missingSlots(input.prompt, counts)) {
    warnings.push({ type: 'missing-slot', slot, attached: counts[slot.kind] })
  }

  return { errors, warnings }
}
