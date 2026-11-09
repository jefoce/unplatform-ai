import { isEmpty, isNil } from 'lodash-es'
import { z } from 'zod'

import type { UploadsById } from '../api/uploads'
import { MAX_IDS, SEED_MAX } from '../constants'
import { minDuration } from '../presets'
import type { VideoPreset } from '../presets/video/types'
import {
  FrameSlotsSchema,
  type GenerationInput,
  GENERATOR_TABS,
} from '../schemas/generation-record'
import type { RuleResult, ValidationContext, ValidationResult } from './common'
import { validateReferences } from './video-references'
import {
  validateAspect,
  validateFrames,
  validateLimits,
  validateModelStatus,
  validatePrompt,
} from './video-rules'

function durationSchema(preset: VideoPreset) {
  const min = minDuration(preset)
  const step = preset.duration.step

  return z
    .number()
    .int()
    .min(min, { message: `Minimum ${min}s` })
    .max(preset.duration.max)
    .refine(
      (value) => {
        return isNil(step) || (value - min) % step === 0
      },
      { message: 'Choose an allowed duration' },
    )
}

function priceInputSchema(preset: VideoPreset) {
  return z.object({
    presetId: z.string(),
    tab: z.enum(GENERATOR_TABS),
    audio: z.boolean(),
    duration: durationSchema(preset),
    aspectRatio: z.string().refine(
      (value) => {
        return value === 'auto' || preset.aspectRatios.includes(value)
      },
      { message: 'Choose an allowed aspect ratio' },
    ),
    resolution: z.string().refine(
      (value) => {
        return preset.resolutions.includes(value)
      },
      { message: 'Choose an allowed resolution' },
    ),
    frames: FrameSlotsSchema,
    references: z.array(z.string()).max(MAX_IDS),
  })
}

function createInputSchema(preset: VideoPreset) {
  return priceInputSchema(preset).extend({
    prompt: z.string().max(preset.promptMaxChars),
    seed: z.number().int().min(0).max(SEED_MAX).nullable(),
  })
}

type PriceInputSchema = ReturnType<typeof priceInputSchema>

type InputSchema = ReturnType<typeof createInputSchema>

export type PriceInput = z.infer<PriceInputSchema>

/** Schema for the price-only estimate request. Prompt and seed are ignored. */
export function buildPriceInputSchema(preset: VideoPreset): PriceInputSchema {
  return priceInputSchema(preset)
}

export function buildInputSchema(preset: VideoPreset): InputSchema {
  return createInputSchema(preset)
}

const DEFAULT_CONTEXT: ValidationContext = { modelStatus: 'unverified', modelReason: null }

interface ValidateInputParams {
  input: GenerationInput
  uploads: UploadsById
  preset: VideoPreset
  ctx?: ValidationContext
}

function runValidation(params: ValidateInputParams, isSettingsOnly: boolean): ValidationResult {
  const { input, uploads, preset, ctx = DEFAULT_CONTEXT } = params

  let status: RuleResult = { errors: [], warnings: [] }
  let schema: PriceInputSchema | InputSchema = buildInputSchema(preset)

  if (isSettingsOnly) {
    schema = buildPriceInputSchema(preset)
  } else {
    status = validateModelStatus(ctx)
  }

  const parsed = schema.safeParse(input)

  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => {
      const field = issue.path.join('.')
      const label = field === '' ? 'input' : field

      return `${label}: ${issue.message}`
    })

    return { ok: false, errors: [...status.errors, ...errors], warnings: [] }
  }

  const groups: RuleResult[] = [status, validateAspect(input, preset)]

  if (!isSettingsOnly) {
    groups.push(validatePrompt(input, preset))
  }

  groups.push(
    validateFrames({ input, uploads, preset }),
    validateReferences({ input, uploads, preset, ctx }),
    validateLimits({ input, uploads, preset, ctx }),
  )

  const errors = groups.flatMap((group) => {
    return group.errors
  })

  const warnings = groups.flatMap((group) => {
    return group.warnings
  })

  return { ok: isEmpty(errors), errors, warnings }
}

export function validateInput(params: ValidateInputParams): ValidationResult {
  return runValidation(params, false)
}

/** Everything except the prompt and model status, so the price shows while the prompt is empty. */
export function validateSettings(params: ValidateInputParams): ValidationResult {
  return runValidation(params, true)
}
