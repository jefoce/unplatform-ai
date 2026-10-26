import { isNil } from 'lodash-es'

import { LOW_RES_MIN_PX, MAX_ACTIVE_JOBS, MAX_INLINE_MEDIA_MB } from './constants'
import { isNonEmptyString } from './guards'
import { aspectAllowed } from './output-size'
import { primaryBinding } from './presets/bindings'
import type { ModelPreset } from './presets/types'
import type { GenerationInput } from './schemas/generation-record'
import { type UploadItem, type UploadsById } from './schemas/upload-item'
import { resolveTransport } from './transport'
import { checkReferenceLimits } from './validation-media'
import type {
  RuleResult,
  ValidateFramesParams,
  ValidateWithContextParams,
  ValidationContext,
  ValidationIssue,
} from './validation-types'

const byteLimit = MAX_INLINE_MEDIA_MB * 1024 * 1024

interface CheckUploadParams {
  id: string | null
  role: string
  uploads: UploadsById
  errors: string[]
}

interface PromptErrorParams {
  input: GenerationInput
  preset: ModelPreset
  hasStartFrame: boolean
}

const promptTextErrors = (params: PromptErrorParams): string[] => {
  const { input, preset, hasStartFrame } = params
  const prompt = input.prompt.trim()
  const errors: string[] = []

  if (prompt.length > preset.promptMaxChars) {
    errors.push(`Prompt is too long (max ${preset.promptMaxChars} characters)`)
  }

  if (prompt === '' && !(preset.promptOptional && hasStartFrame)) {
    errors.push('Prompt is required')
  }

  return errors
}

const aspectErrors = (params: PromptErrorParams): string[] => {
  const { input, preset, hasStartFrame } = params
  const aspect = input.aspectRatio

  if (aspect === 'auto') {
    const hasAutoFrame = input.tab === 'frames' && hasStartFrame && preset.autoAspectWithFrames

    if (hasAutoFrame) {
      return []
    }

    return ['Auto aspect ratio needs a start frame']
  }

  if (aspectAllowed({ preset, resolution: input.resolution, aspect })) {
    return []
  }

  const resolutions = preset.resolutions.filter((resolution) => {
    const size = preset.outputSizes?.[resolution]?.[aspect]

    return !isNil(size)
  })

  return [`Aspect ${aspect} is only available at ${resolutions.join(' or ')}`]
}

/** Missing and unconfigured models block with the catalog reason first. */
export function validateModelStatus(ctx: ValidationContext): RuleResult {
  if (ctx.modelStatus !== 'missing' && ctx.modelStatus !== 'no_provider') {
    return { errors: [], warnings: [] }
  }

  return { errors: [ctx.modelReason ?? 'Model unavailable'], warnings: [] }
}

export function validatePrompt(input: GenerationInput, preset: ModelPreset): RuleResult {
  const hasStartFrame = input.tab === 'frames' && Boolean(input.frames.start)
  const params = { input, preset, hasStartFrame }

  return { errors: [...promptTextErrors(params), ...aspectErrors(params)], warnings: [] }
}

interface CheckFrameOrderParams extends ValidateFramesParams {
  errors: string[]
}

const checkFrameOrder = (params: CheckFrameOrderParams): void => {
  const { input, preset, errors } = params

  const hasEnd = isNonEmptyString(input.frames.end)
  const hasStart = isNonEmptyString(input.frames.start)

  if (hasEnd && !hasStart) {
    errors.push('Add a start frame first')
  }

  if (hasEnd && !preset.frames.end) {
    errors.push('End frame is not supported by this model')
  }
}

const checkFrameKind = (params: CheckUploadParams): void => {
  const { role, errors } = params
  const upload = checkUpload(params)

  if (upload && upload.kind !== 'image') {
    errors.push(`${role} must be an image`)
  }
}

export function validateFrames(params: ValidateFramesParams): RuleResult {
  const { input, uploads, preset } = params
  const errors: string[] = []

  if (input.tab !== 'frames') {
    return { errors, warnings: [] }
  }

  checkFrameOrder({ input, uploads, preset, errors })
  checkFrameKind({ id: input.frames.start, role: 'Start frame', uploads, errors })

  if (isNonEmptyString(input.frames.start) && isNonEmptyString(input.frames.end)) {
    checkFrameKind({ id: input.frames.end, role: 'End frame', uploads, errors })
  }

  for (const upload of attachedMedia(input, uploads)) {
    if (upload.kind === 'image') {
      checkReferenceLimits({ upload, preset, errors })
    }
  }

  return { errors, warnings: [] }
}

export function validateLimits(params: ValidateWithContextParams): RuleResult {
  const { input, uploads, preset, ctx } = params
  const errors: string[] = []
  const warnings: ValidationIssue[] = []
  const attached = attachedMedia(input, uploads)

  for (const upload of attached) {
    if (upload.kind === 'image') {
      continue
    }

    const transport = resolveTransport({
      binding: primaryBinding(preset),
      kind: upload.kind,
      remoteConfigured: ctx.remoteConfigured ?? false,
    })

    if (transport !== 'base64') {
      continue
    }

    if (upload.sizeBytes > byteLimit) {
      const mb = Math.ceil(upload.sizeBytes / (1024 * 1024))

      errors.push(`Reference too large to send inline (${mb} MB, max ${MAX_INLINE_MEDIA_MB} MB)`)
    }
  }

  const isLowRes = attached.some((upload) => {
    return (
      upload.kind === 'image' &&
      !isNil(upload.width) &&
      !isNil(upload.height) &&
      Math.min(upload.width, upload.height) < LOW_RES_MIN_PX
    )
  })

  if (isLowRes) {
    warnings.push({ type: 'text', text: 'Low resolution input, output may look soft' })
  }

  if ((ctx.activeCount ?? 0) >= MAX_ACTIVE_JOBS) {
    errors.push(`${MAX_ACTIVE_JOBS} videos already generating. Wait for one to finish.`)
  }

  return { errors, warnings }
}

/** Uploads attached by the active tab, in rule order. */
function attachedMedia(input: GenerationInput, uploads: UploadsById): UploadItem[] {
  if (input.tab === 'references') {
    return input.references
      .map((id) => {
        return uploads[id]
      })
      .filter((upload): upload is UploadItem => {
        return Boolean(upload)
      })
  }

  const startId = input.frames.start
  const endId = input.frames.end
  let start: UploadItem | undefined

  if (isNonEmptyString(startId)) {
    start = uploads[startId]
  }

  let end: UploadItem | undefined

  if (isNonEmptyString(startId) && isNonEmptyString(endId)) {
    end = uploads[endId]
  }

  return [start, end].filter((upload): upload is UploadItem => {
    return Boolean(upload)
  })
}

function checkUpload(params: CheckUploadParams): UploadItem | null {
  const { id, role, uploads, errors } = params

  if (!isNonEmptyString(id)) {
    return null
  }

  const upload = uploads[id]

  if (isNil(upload)) {
    errors.push(`${role} file not found`)

    return null
  }

  if (upload.missing === true) {
    errors.push(`File missing: ${upload.originalName}`)
  }

  return upload
}
