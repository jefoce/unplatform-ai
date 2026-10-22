import type { ModelPreset } from './presets'
import type { RefSlot } from './prompt-tokens'
import type { GenerationInput, UploadItem } from './types'

export type ValidationIssue =
  { type: 'missing-slot'; slot: RefSlot; attached: number } | { type: 'text'; text: string }

export interface ValidationResult {
  ok: boolean
  errors: string[]
  warnings: ValidationIssue[]
}

/** Errors and warnings from one validation rule group. */
export interface RuleResult {
  errors: string[]
  warnings: ValidationIssue[]
}

export interface ValidationContext {
  activeCount?: number
  remoteConfigured?: boolean
}

export interface ValidateFramesParams {
  input: GenerationInput
  uploads: Record<string, UploadItem>
  preset: ModelPreset
}

export interface ValidateWithContextParams extends ValidateFramesParams {
  ctx: ValidationContext
}
