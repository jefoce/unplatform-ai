import { isNil, upperFirst } from 'lodash-es'

import { IMAGE_COUNT_MAX, IMAGE_REFERENCE_MAX } from '../constants'
import { isNonEmptyString } from '../guards'
import type { MediaKindCounts } from '../media/media-types'
import type { ImageAspectChoice, ImageOption, ImagePreset } from '../presets/image/types'
import { missingSlots } from '../prompt-tokens'
import type { ImageGenerationInput } from '../schemas/image-record'
import type { ValidationIssue } from './common'

interface ControlCheckParams<T extends string> {
  label: string
  options: readonly ImageOption<T>[] | null
  value: T | null
}

const issue = (text: string): ValidationIssue[] => {
  return [{ type: 'text', text }]
}

const checkControl = <T extends string>(params: ControlCheckParams<T>): ValidationIssue[] => {
  const { label, options, value } = params

  if (isNil(options)) {
    if (isNil(value)) {
      return []
    }

    return issue(`This model does not take a ${label}`)
  }

  if (isNil(value)) {
    return issue(`Choose a ${label}`)
  }

  const isSupported = options.some((option) => {
    return option.value === value
  })

  if (!isSupported) {
    return issue(`${upperFirst(label)} is not supported by this model`)
  }

  return []
}

interface PromptProblems {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

const promptProblems = (preset: ImagePreset, prompt: string): PromptProblems => {
  if (!isNonEmptyString(prompt.trim())) {
    return { errors: issue('Prompt is required'), warnings: [] }
  }

  if (prompt.length > preset.promptMaxChars) {
    return { errors: [], warnings: issue('Prompt is too long') }
  }

  return { errors: [], warnings: [] }
}

const countProblems = (count: number): ValidationIssue[] => {
  if (Number.isInteger(count) && count >= 1 && count <= IMAGE_COUNT_MAX) {
    return []
  }

  return issue('Invalid image count')
}

const aspectProblems = (preset: ImagePreset, aspectRatio: ImageAspectChoice): ValidationIssue[] => {
  if (preset.aspectRatios.includes(aspectRatio)) {
    return []
  }

  return issue('Aspect ratio is not supported by this model')
}

const referenceProblems = (preset: ImagePreset, count: number): ValidationIssue[] => {
  if (count <= Math.min(preset.referenceMax, IMAGE_REFERENCE_MAX)) {
    return []
  }

  return issue('Too many references')
}

const seedProblems = (preset: ImagePreset, seed: number | null): ValidationIssue[] => {
  if (isNil(seed)) {
    return []
  }

  if (!preset.seed) {
    return issue('This model does not take a seed')
  }

  if (!Number.isInteger(seed) || seed < 0) {
    return issue('Invalid seed')
  }

  return []
}

/** Image references are the only kind, so every slot is numbered by draft order. */
const mentionProblems = (input: ImageGenerationInput): ValidationIssue[] => {
  const counts: MediaKindCounts = { image: input.references.length, video: 0, audio: 0 }

  return missingSlots(input.prompt, counts).map((slot) => {
    return { type: 'missing-slot', slot, attached: counts[slot.kind] }
  })
}

/** Everything except the prompt. The estimate runs while these pass. */
export function validateImageSettings(
  preset: ImagePreset,
  input: ImageGenerationInput,
): ValidationIssue[] {
  return [
    ...countProblems(input.count),
    ...aspectProblems(preset, input.aspectRatio),
    ...checkControl({
      label: 'resolution',
      options: preset.resolutions,
      value: input.resolution,
    }),
    ...checkControl({ label: 'quality', options: preset.qualities, value: input.quality }),
    ...checkControl({
      label: 'background',
      options: preset.backgrounds,
      value: input.background,
    }),
    ...referenceProblems(preset, input.references.length),
    ...seedProblems(preset, input.seed),
  ]
}

/** Prompt-only issues, so an empty prompt does not block the estimate. */
export function validateImagePrompt(preset: ImagePreset, prompt: string): ValidationIssue[] {
  const problems = promptProblems(preset, prompt)

  return [...problems.errors, ...problems.warnings]
}

/** Non-blocking notices, shown under the prompt instead of a toast. */
export function imageWarnings(preset: ImagePreset, input: ImageGenerationInput): ValidationIssue[] {
  const problems = promptProblems(preset, input.prompt)
  const tooMany = referenceProblems(preset, input.references.length)

  return [...problems.warnings, ...tooMany, ...mentionProblems(input)]
}

/** Returns validation issues, empty when the input is valid for the preset. */
export function validateImageInput(
  preset: ImagePreset,
  input: ImageGenerationInput,
): ValidationIssue[] {
  return [
    ...validateImageSettings(preset, input),
    ...validateImagePrompt(preset, input.prompt),
    ...mentionProblems(input),
  ]
}
