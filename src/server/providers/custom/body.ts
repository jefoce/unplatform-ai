import 'server-only'

import { isNil } from 'lodash-es'

import { primaryBinding } from '@/core/presets/common/bindings'
import { renderPromptForApi } from '@/core/prompt-tokens'
import type { Dict } from '@/core/utility-types'

import type { ImageGenerateParams, ResolvedMedia, SubmitJobParams } from '../types'

interface UpaiImageUrl {
  url: string
}

interface UpaiFrameImage {
  type: 'image_url'
  image_url: UpaiImageUrl
  frame_type: 'first_frame' | 'last_frame'
}

interface UpaiImageReference {
  type: 'image_url'
  image_url: UpaiImageUrl
}

interface UpaiVideoReference {
  type: 'video_url'
  video_url: UpaiImageUrl
}

interface UpaiAudioReference {
  type: 'audio_url'
  audio_url: UpaiImageUrl
}

type UpaiReference = UpaiImageReference | UpaiVideoReference | UpaiAudioReference

export interface UpaiVideoBody {
  model: string
  prompt: string
  duration: number
  resolution: string
  aspect_ratio?: string
  seed?: number
  frame_images?: UpaiFrameImage[]
  input_references?: UpaiReference[]
}

export interface UpaiImageBody {
  model: string
  prompt: string
  n?: number
  resolution?: string
  aspect_ratio?: string
  seed?: number
  input_references?: UpaiImageReference[]
}

function mediaPayload(media: Readonly<Dict<ResolvedMedia>>, id: string): ResolvedMedia {
  const payload = media[id]

  if (isNil(payload)) {
    throw new Error(`Missing media for input ${id}`)
  }

  return payload
}

function referencePart(media: ResolvedMedia): UpaiReference {
  const url = { url: media.url }

  if (media.kind === 'image') {
    return { type: 'image_url', image_url: url }
  }

  if (media.kind === 'video') {
    return { type: 'video_url', video_url: url }
  }

  return { type: 'audio_url', audio_url: url }
}

function framePart(media: ResolvedMedia, frameType: 'first_frame' | 'last_frame'): UpaiFrameImage {
  return { type: 'image_url', image_url: { url: media.url }, frame_type: frameType }
}

function frameParts(params: SubmitJobParams): UpaiFrameImage[] {
  const { input, preset, media } = params
  const { start, end } = input.frames

  if (!preset.frames.start || isNil(start)) {
    return []
  }

  const frames = [framePart(mediaPayload(media, start), 'first_frame')]

  if (preset.frames.end && !isNil(end)) {
    frames.push(framePart(mediaPayload(media, end), 'last_frame'))
  }

  return frames
}

function referenceParts(params: SubmitJobParams): UpaiReference[] {
  const { input, media } = params

  return input.references.map((id) => {
    return referencePart(mediaPayload(media, id))
  })
}

/** Same slots and order as the OpenRouter body, minus the fields upai does not take. */
export function buildVideoBody(params: SubmitJobParams): UpaiVideoBody {
  const { input, preset } = params

  const body: UpaiVideoBody = {
    model: primaryBinding(preset).modelId,
    prompt: renderPromptForApi(input.prompt.trim(), preset),
    duration: input.duration,
    resolution: input.resolution,
  }

  if (input.aspectRatio !== 'auto') {
    body.aspect_ratio = input.aspectRatio
  }

  if (preset.seed && !isNil(input.seed)) {
    body.seed = input.seed
  }

  if (input.tab === 'frames') {
    const frames = frameParts(params)

    if (frames.length > 0) {
      body.frame_images = frames
    }

    return body
  }

  if (input.references.length > 0) {
    body.input_references = referenceParts(params)
  }

  return body
}

/** Only fields the mapped preset declares, matching the image route rules. */
export function buildImageBody(params: ImageGenerateParams): UpaiImageBody {
  const { preset, input, references } = params

  const body: UpaiImageBody = {
    model: primaryBinding(preset).modelId,
    prompt: renderPromptForApi(input.prompt.trim(), preset),
  }

  const aspectRatio = input.aspectRatio === 'auto' ? null : input.aspectRatio

  const candidates: Partial<Record<string, unknown>> = {
    n: input.count,
    resolution: input.resolution,
    aspect_ratio: aspectRatio,
    seed: input.seed,
  }

  for (const field of preset.params) {
    const value = candidates[field]

    if (!isNil(value)) {
      Object.assign(body, { [field]: value })
    }
  }

  if (references.length > 0 && preset.params.includes('input_references')) {
    body.input_references = references.map((reference) => {
      return { type: 'image_url', image_url: { url: reference.dataUrl } }
    })
  }

  return body
}
