import { isEmpty } from 'lodash-es'
import { z } from 'zod'

import { SEED_MAX } from './constants'
import { KIND_PLURAL } from './media-kinds'
import { minDuration } from './presets'
import type { ModelPreset } from './presets/types'
import { slotLabel } from './prompt-tokens'
import { FrameSlotsSchema, type GenerationInput, GENERATOR_TABS } from './schemas/generation-record'
import type { UploadsById } from './schemas/upload-item'
import { validateReferences } from './validation-references'
import {
  validateFrames,
  validateLimits,
  validateModelStatus,
  validatePrompt,
} from './validation-rules'
import type {
  RuleResult,
  ValidationContext,
  ValidationIssue,
  ValidationResult,
} from './validation-types'

/** Exact display text for a warning. */
export function issueText(issue: ValidationIssue): string {
  if (issue.type === 'text') {
    return issue.text
  }

  return `@${slotLabel(issue.slot)} is not attached (${issue.attached} ${KIND_PLURAL[issue.slot.kind]})`
}

function durationSchema(preset: ModelPreset) {
  const min = minDuration(preset)

  return z
    .number()
    .int()
    .min(min, { message: `Minimum ${min}s` })
    .max(preset.duration.max)
}

function priceInputSchema(preset: ModelPreset) {
  return z.object({
    presetId: z.string(),
    tab: z.enum(GENERATOR_TABS),
    audio: z.boolean(),
    duration: durationSchema(preset),
    aspectRatio: z.enum([...preset.aspectRatios, 'auto']),
    resolution: z.enum(preset.resolutions),
    frames: FrameSlotsSchema,
    references: z.array(z.string()),
  })
}

function createInputSchema(preset: ModelPreset) {
  return priceInputSchema(preset).extend({
    prompt: z.string().max(preset.promptMaxChars),
    seed: z.number().int().min(0).max(SEED_MAX).nullable(),
  })
}

type PriceInputSchema = ReturnType<typeof priceInputSchema>

type InputSchema = ReturnType<typeof createInputSchema>

export type PriceInput = z.infer<PriceInputSchema>

/** Schema for the price-only estimate request. Prompt and seed are ignored. */
export function buildPriceInputSchema(preset: ModelPreset): PriceInputSchema {
  return priceInputSchema(preset)
}

export function buildInputSchema(preset: ModelPreset): InputSchema {
  return createInputSchema(preset)
}

const DEFAULT_CONTEXT: ValidationContext = { modelStatus: 'unverified', modelReason: null }

interface ValidateInputParams {
  input: GenerationInput
  uploads: UploadsById
  preset: ModelPreset
  ctx?: ValidationContext
}

export function validateInput(params: ValidateInputParams): ValidationResult {
  const { input, uploads, preset, ctx = DEFAULT_CONTEXT } = params
  const status = validateModelStatus(ctx)
  const parsed = buildInputSchema(preset).safeParse(input)

  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => {
      const field = issue.path.join('.')
      const label = field === '' ? 'input' : field

      return `${label}: ${issue.message}`
    })

    return { ok: false, errors: [...status.errors, ...errors], warnings: [] }
  }

  const groups: RuleResult[] = [
    status,
    validatePrompt(input, preset),
    validateFrames({ input, uploads, preset }),
    validateReferences({ input, uploads, preset, ctx }),
    validateLimits({ input, uploads, preset, ctx }),
  ]

  const errors = groups.flatMap((group) => {
    return group.errors
  })

  const warnings = groups.flatMap((group) => {
    return group.warnings
  })

  return { ok: isEmpty(errors), errors, warnings }
}
