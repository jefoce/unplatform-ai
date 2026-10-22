import { isNil } from 'lodash-es'

import type { ModelPreset } from './presets'
import { renderPromptForApi } from './prompt-tokens'
import type { GenerationInput, MediaKind } from './types'

export interface ResolvedMedia {
  id: string
  kind: MediaKind
  url: string
}

interface OpenRouterFramePart {
  type: 'image_url'
  image_url: { url: string }
  frame_type: 'first_frame' | 'last_frame'
}

type OpenRouterReferencePart =
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'video_url'; video_url: { url: string } }
  | { type: 'audio_url'; audio_url: { url: string } }

export interface OpenRouterVideoBody {
  model: string
  duration: number
  resolution: string
  generate_audio?: boolean
  prompt?: string
  seed?: number
  aspect_ratio?: string
  frame_images?: OpenRouterFramePart[]
  input_references?: OpenRouterReferencePart[]
}

const framePart = (
  media: ResolvedMedia,
  frameType: 'first_frame' | 'last_frame',
): OpenRouterFramePart => ({
  type: 'image_url',
  image_url: { url: media.url },
  frame_type: frameType,
})

const referencePart = (media: ResolvedMedia): OpenRouterReferencePart => {
  if (media.kind === 'image') return { type: 'image_url', image_url: { url: media.url } }

  if (media.kind === 'video') return { type: 'video_url', video_url: { url: media.url } }

  return { type: 'audio_url', audio_url: { url: media.url } }
}

export interface BuildOpenRouterBodyParams {
  input: GenerationInput
  preset: ModelPreset
  media: Record<string, ResolvedMedia>
}

const audioFields = (params: BuildOpenRouterBodyParams): Partial<OpenRouterVideoBody> => {
  const { input, preset } = params

  if (!preset.audio.supported) return {}
  return { generate_audio: input.audio }
}

const promptFields = (params: BuildOpenRouterBodyParams): Partial<OpenRouterVideoBody> => {
  const { input, preset } = params
  const prompt = input.prompt.trim()

  if (prompt === '') return {}
  return { prompt: renderPromptForApi(prompt, preset) }
}

const seedFields = (params: BuildOpenRouterBodyParams): Partial<OpenRouterVideoBody> => {
  const { input, preset } = params

  if (isNil(input.seed) || !preset.seed) return {}
  return { seed: input.seed }
}

const aspectFields = (params: BuildOpenRouterBodyParams): Partial<OpenRouterVideoBody> => {
  const { input } = params

  if (input.aspectRatio === 'auto') return {}
  return { aspect_ratio: input.aspectRatio }
}

const frameParts = (params: BuildOpenRouterBodyParams): OpenRouterFramePart[] => {
  const { input, preset, media } = params
  const frames: OpenRouterFramePart[] = []

  if (preset.frames.start && !isNil(input.frames.start) && input.frames.start !== '') {
    frames.push(framePart(media[input.frames.start], 'first_frame'))
  }

  if (
    preset.frames.end &&
    !isNil(input.frames.start) &&
    input.frames.start !== '' &&
    !isNil(input.frames.end) &&
    input.frames.end !== ''
  ) {
    frames.push(framePart(media[input.frames.end], 'last_frame'))
  }

  return frames
}

const mediaFields = (params: BuildOpenRouterBodyParams): Partial<OpenRouterVideoBody> => {
  const { input, media } = params

  if (input.tab === 'frames') {
    const frames = frameParts(params)

    if (frames.length === 0) return {}
    return { frame_images: frames }
  }

  if (input.references.length === 0) return {}
  return { input_references: input.references.map((id) => referencePart(media[id])) }
}

export function buildOpenRouterBody(params: BuildOpenRouterBodyParams): OpenRouterVideoBody {
  const { input, preset } = params

  return {
    model: preset.slug,
    duration: input.duration,
    resolution: input.resolution,
    ...audioFields(params),
    ...promptFields(params),
    ...seedFields(params),
    ...aspectFields(params),
    ...mediaFields(params),
  }
}
