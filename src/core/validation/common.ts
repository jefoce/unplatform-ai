import type { UploadsById } from '../api/uploads'
import type { ModelStatus } from '../catalog'
import { KIND_PLURAL } from '../media/media-kinds'
import type { VideoPreset } from '../presets/video/types'
import { type RefSlot, slotLabel } from '../prompt-tokens'
import type { GenerationInput } from '../schemas/generation-record'

interface MissingSlotIssue {
  type: 'missing-slot'
  slot: RefSlot
  attached: number
}

interface TextIssue {
  type: 'text'
  text: string
}

export type ValidationIssue = MissingSlotIssue | TextIssue

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
  modelStatus: ModelStatus
  modelReason: string | null
}

export interface ValidateFramesParams {
  input: GenerationInput
  uploads: UploadsById
  preset: VideoPreset
}

export interface ValidateWithContextParams extends ValidateFramesParams {
  ctx: ValidationContext
}

/** Exact display text for a warning. */
export function issueText(issue: ValidationIssue): string {
  if (issue.type === 'text') {
    return issue.text
  }

  return `@${slotLabel(issue.slot)} is not attached (${issue.attached} ${KIND_PLURAL[issue.slot.kind]})`
}
