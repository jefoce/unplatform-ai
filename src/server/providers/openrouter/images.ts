import 'server-only'

import { isNil } from 'lodash-es'
import { z } from 'zod'

import { FETCH_TIMEOUTS, IMAGE_OUTPUT_MAX_BYTES, MAX_PROVIDER_B64_CHARS } from '@/core/constants'
import { messageOf } from '@/core/errors'
import { isNonEmptyString, isOneOf } from '@/core/guards'
import { primaryBinding } from '@/core/presets/common/bindings'
import type { ImageParam } from '@/core/presets/image/types'
import { renderPromptForApi } from '@/core/prompt-tokens'
import { IMAGE_OUTPUT_MEDIA_TYPES } from '@/core/schemas/image-record'
import type { TestResult } from '@/core/types'

import { getSecret } from '../../secrets'
import type {
  EndpointSignal,
  ImageGenerateParams,
  ImageProvider,
  ImageReferencePayload,
  ImageResult,
  ProviderImageModelList,
} from '../types'
import type { OpenRouterImagePart } from './body'
import { OpenRouterError } from './error'
import { classifyOpenRouterError } from './errors'
import { BASE_URL, errorFromResponse, headers, issueSummary, request } from './http'
import { fetchImageEndpointsResult, fetchImageModelList } from './images-models'

const IMAGES_URL = `${BASE_URL}/api/v1/images`

/** Room for the JSON envelope around the base64 payloads. */
const IMAGE_RESPONSE_OVERHEAD_BYTES = 64 * 1024

const RawItemSchema = z
  .object({
    b64_json: z.string().min(1),
    media_type: z.string(),
  })
  .loose()

const UsageSchema = z.object({ cost: z.number().nullish() }).loose()

const ImageResponseSchema = z
  .object({
    data: z.array(z.unknown()).min(1),
    usage: UsageSchema.nullish(),
  })
  .loose()

interface OpenRouterImageBody {
  model: string
  prompt: string
  n?: number
  aspect_ratio?: string
  resolution?: string
  quality?: string
  background?: string
  seed?: number
  input_references?: OpenRouterImagePart[]
}

/** Base64 budget for every requested image plus the JSON envelope. */
function imageResponseCapBytes(count: number): number {
  return count * Math.ceil((IMAGE_OUTPUT_MAX_BYTES * 4) / 3) + IMAGE_RESPONSE_OVERHEAD_BYTES
}

function chargedUnknown(status: number, message: string): OpenRouterError {
  return new OpenRouterError({ message, status, code: 'charged_unknown' })
}

/** Reads at most `capBytes`, so an unbounded body never reaches the parser. */
async function readCappedBody(res: Response, capBytes: number): Promise<Buffer> {
  if (isNil(res.body)) {
    return Buffer.from(await res.arrayBuffer())
  }

  const chunks: Buffer[] = []
  let total = 0
  const reader = res.body.getReader()

  for (;;) {
    const { done: isDone, value } = await reader.read()

    if (isDone) {
      break
    }

    total += value.byteLength

    if (total > capBytes) {
      await reader.cancel()

      throw chargedUnknown(res.status, 'Image response is larger than the limit')
    }

    chunks.push(Buffer.from(value))
  }

  return Buffer.concat(chunks, total)
}

/** Parses a 200 body under the response cap. Any failure there may be billed. */
async function readImageBody(res: Response, capBytes: number): Promise<unknown> {
  const declared = res.headers.get('content-length')

  if (!isNil(declared) && Number(declared) > capBytes) {
    throw chargedUnknown(res.status, 'Image response is larger than the limit')
  }

  try {
    const body = await readCappedBody(res, capBytes)

    if (body.byteLength > capBytes) {
      throw chargedUnknown(res.status, 'Image response is larger than the limit')
    }

    return JSON.parse(body.toString('utf8'))
  } catch (error) {
    if (error instanceof OpenRouterError) {
      throw error
    }

    throw chargedUnknown(res.status, 'Invalid image response')
  }
}

/** OpenRouter image adapter. One synchronous call per planned count. */
export function createOpenRouterImageProvider(): ImageProvider {
  return {
    id: 'openrouter',
    isConfigured,
    generate,
    listModels,
    listEndpoints,
    testConnection,
  }
}

async function listEndpoints(modelId: string): Promise<EndpointSignal> {
  const { state, reason } = await fetchImageEndpointsResult(modelId)

  return { state, reason }
}

function isConfigured(): boolean {
  return isNonEmptyString(getSecret('OPENROUTER_API_KEY'))
}

function referenceParts(references: readonly ImageReferencePayload[]): OpenRouterImagePart[] {
  return references.map((reference) => {
    return { type: 'image_url', image_url: { url: reference.dataUrl } }
  })
}

/** Every field with its value, or null when the input leaves it unset. */
function candidateValues(params: ImageGenerateParams): Partial<Record<ImageParam, unknown>> {
  const { input, references } = params
  const aspectRatio = input.aspectRatio === 'auto' ? null : input.aspectRatio
  let inputReferences: OpenRouterImagePart[] | null = null

  if (references.length > 0) {
    inputReferences = referenceParts(references)
  }

  return {
    n: input.count,
    aspect_ratio: aspectRatio,
    resolution: input.resolution,
    quality: input.quality,
    background: input.background,
    seed: input.seed,
    input_references: inputReferences,
  }
}

/** Sends only the fields the preset declares, so other models never see them. */
export function buildImageBody(params: ImageGenerateParams): OpenRouterImageBody {
  const { preset } = params
  const candidates = candidateValues(params)

  const body: OpenRouterImageBody = {
    model: primaryBinding(preset).modelId,
    prompt: renderPromptForApi(params.input.prompt.trim(), preset),
  }

  for (const field of preset.params) {
    const value = candidates[field]

    if (!isNil(value)) {
      Object.assign(body, { [field]: value })
    }
  }

  return body
}

async function generate(params: ImageGenerateParams): Promise<ImageResult> {
  try {
    const res = await request({
      url: IMAGES_URL,
      init: {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify(buildImageBody(params)),
      },
      timeoutMs: FETCH_TIMEOUTS.submit,
    })

    if (!res.ok) {
      throw await errorFromResponse(res)
    }

    const parsed = ImageResponseSchema.safeParse(
      await readImageBody(res, imageResponseCapBytes(params.input.count)),
    )

    if (!parsed.success) {
      throw chargedUnknown(res.status, `Invalid image response (${issueSummary(parsed.error)})`)
    }

    const items = parsed.data.data.map((raw) => {
      const item = RawItemSchema.safeParse(raw)

      if (!item.success) {
        return { error: `Invalid image item (${issueSummary(item.error)})` }
      }

      if (item.data.b64_json.length > MAX_PROVIDER_B64_CHARS) {
        return { error: 'Image is larger than the upload limit' }
      }

      if (!isOneOf(IMAGE_OUTPUT_MEDIA_TYPES, item.data.media_type)) {
        return { error: `Unsupported image type: ${item.data.media_type.slice(0, 40)}` }
      }

      return { b64: item.data.b64_json, mediaType: item.data.media_type }
    })

    return { items, costUsd: parsed.data.usage?.cost ?? null }
  } catch (error) {
    throw classifyOpenRouterError(error)
  }
}

async function listModels(): Promise<ProviderImageModelList> {
  return fetchImageModelList()
}

async function testConnection(): Promise<TestResult> {
  if (!isConfigured()) {
    return { ok: false, error: 'OpenRouter key is not set. Open Settings.' }
  }

  try {
    const res = await fetch(`${BASE_URL}/api/v1/key`, {
      headers: { Authorization: `Bearer ${getSecret('OPENROUTER_API_KEY')}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
    })

    if (!res.ok) {
      return { ok: false, error: `OpenRouter ${res.status} ${res.statusText}` }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, error: messageOf(error, 'Test failed') }
  }
}
