import 'server-only'

import { isNil } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import type { MediaKind } from '@/core/media-types'
import { activeBinding } from '@/core/presets/bindings'
import type { ModelPreset, ProviderBinding } from '@/core/presets/types'
import { renderPromptForApi } from '@/core/prompt-tokens'
import type { GenerationInput } from '@/core/schemas/generation-record'
import type { Dict } from '@/core/utility-types'

import { getSecret } from '../../secrets'

interface MediaPayload {
  id: string
  kind: MediaKind
  url: string
}

interface OpenRouterImageUrl {
  url: string
}

interface OpenRouterImagePart {
  type: 'image_url'
  image_url: OpenRouterImageUrl
}

interface OpenRouterVideoPart {
  type: 'video_url'
  video_url: OpenRouterImageUrl
}

interface OpenRouterAudioPart {
  type: 'audio_url'
  audio_url: OpenRouterImageUrl
}

interface OpenRouterFramePart extends OpenRouterImagePart {
  frame_type: 'first_frame' | 'last_frame'
}

type OpenRouterReferencePart = OpenRouterImagePart | OpenRouterVideoPart | OpenRouterAudioPart

interface OpenRouterVideoBody {
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
  media: MediaPayload,
  frameType: 'first_frame' | 'last_frame',
): OpenRouterFramePart => {
  return {
    type: 'image_url',
    image_url: { url: media.url },
    frame_type: frameType,
  }
}

const referencePart = (media: MediaPayload): OpenRouterReferencePart => {
  if (media.kind === 'image') {
    return { type: 'image_url', image_url: { url: media.url } }
  }

  if (media.kind === 'video') {
    return { type: 'video_url', video_url: { url: media.url } }
  }

  return { type: 'audio_url', audio_url: { url: media.url } }
}

interface BuildRequestBodyParams {
  input: GenerationInput
  preset: ModelPreset
  media: Dict<MediaPayload>
}

const audioFields = (params: BuildRequestBodyParams): Partial<OpenRouterVideoBody> => {
  const { input, preset } = params

  if (!preset.audio.supported) {
    return {}
  }

  return { generate_audio: input.audio }
}

const promptFields = (params: BuildRequestBodyParams): Partial<OpenRouterVideoBody> => {
  const { input, preset } = params
  const prompt = input.prompt.trim()

  if (prompt === '') {
    return {}
  }

  return { prompt: renderPromptForApi(prompt, preset) }
}

const seedFields = (params: BuildRequestBodyParams): Partial<OpenRouterVideoBody> => {
  const { input, preset } = params

  if (isNil(input.seed) || !preset.seed) {
    return {}
  }

  return { seed: input.seed }
}

const aspectFields = (params: BuildRequestBodyParams): Partial<OpenRouterVideoBody> => {
  const { input } = params

  if (input.aspectRatio === 'auto') {
    return {}
  }

  return { aspect_ratio: input.aspectRatio }
}

const mediaPayload = (media: Dict<MediaPayload>, id: string): MediaPayload => {
  const payload = media[id]

  if (isNil(payload)) {
    throw new Error(`Missing media for input ${id}`)
  }

  return payload
}

const frameParts = (params: BuildRequestBodyParams): OpenRouterFramePart[] => {
  const { input, preset, media } = params
  const { start, end } = input.frames

  if (!preset.frames.start || isNil(start)) {
    return []
  }

  const frames: OpenRouterFramePart[] = [framePart(mediaPayload(media, start), 'first_frame')]

  if (preset.frames.end && !isNil(end)) {
    frames.push(framePart(mediaPayload(media, end), 'last_frame'))
  }

  return frames
}

const mediaFields = (params: BuildRequestBodyParams): Partial<OpenRouterVideoBody> => {
  const { input, media } = params

  if (input.tab === 'frames') {
    const frames = frameParts(params)

    if (frames.length === 0) {
      return {}
    }

    return { frame_images: frames }
  }

  if (input.references.length === 0) {
    return {}
  }

  const references = input.references.map((id) => {
    return referencePart(mediaPayload(media, id))
  })

  return { input_references: references }
}

function isBindingConfigured(binding: ProviderBinding): boolean {
  return binding.provider === 'openrouter' && isNonEmptyString(getSecret('OPENROUTER_API_KEY'))
}

export function buildRequestBody(params: BuildRequestBodyParams): OpenRouterVideoBody {
  const { input, preset } = params
  const binding = activeBinding(preset, isBindingConfigured)

  return {
    model: binding.modelId,
    duration: input.duration,
    resolution: input.resolution,
    ...audioFields(params),
    ...promptFields(params),
    ...seedFields(params),
    ...aspectFields(params),
    ...mediaFields(params),
  }
}
