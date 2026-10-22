import 'server-only'

import { isNil, isString } from 'lodash-es'
import { z } from 'zod'

import { FETCH_TIMEOUTS, PROVIDER_RAW_MAX_CHARS } from '@/core/constants'
import { isRecord } from '@/core/guards'

import { getSecret } from '../secrets'
import { OpenRouterError } from './error'
import { mockContent, type MockContentFallback, mockJob, mockSubmit } from './mock-provider'

export { OpenRouterError } from './error'

const BASE_URL = 'https://openrouter.ai'

const SubmitSchema = z
  .object({
    id: z.string(),
    polling_url: z.string().optional(),
    status: z.string(),
  })
  .loose()

const JobSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    generation_id: z.string().optional(),
    unsigned_urls: z.array(z.string()).optional(),
    urls: z.array(z.string()).optional(),
    expires_at: z.number().optional(),
    usage: z
      .object({
        cost: z.number().nullable().optional(),
        is_byok: z.boolean().optional(),
      })
      .loose()
      .optional(),
    error: z.string().optional(),
  })
  .loose()

export type VideoJobResponse = z.infer<typeof JobSchema>

export function isMockMode(): boolean {
  return process.env.OPENROUTER_MOCK === '1'
}

/** Submits a video generation request. */
export async function submitVideo(
  body: unknown,
): Promise<{ id: string; polling_url?: string; status: string }> {
  if (isMockMode()) return mockSubmit(body)

  const res = await request({
    url: `${BASE_URL}/api/v1/videos`,
    init: {
      method: 'POST',
      headers: headers(true),
      body: JSON.stringify(body),
    },
    timeoutMs: FETCH_TIMEOUTS.submit,
  })

  if (!res.ok) throw await errorFromResponse(res)

  const parsed = SubmitSchema.safeParse(await res.json().catch(() => null))

  if (!parsed.success)
    throw new OpenRouterError({ message: 'Invalid submit response', status: res.status })

  return parsed.data
}

/** Reads one job. `submittedAt` is the mock clock fallback after a restart. */
export async function getVideoJob(
  id: string,
  opts?: { submittedAt?: string },
): Promise<VideoJobResponse> {
  if (isMockMode()) return mockJob(id, opts?.submittedAt)

  const res = await request({
    url: `${BASE_URL}/api/v1/videos/${encodeURIComponent(id)}`,
    init: {
      headers: headers(false),
      cache: 'no-store',
    },
    timeoutMs: FETCH_TIMEOUTS.poll,
  })

  if (!res.ok) throw await errorFromResponse(res)

  const parsed = JobSchema.safeParse(await res.json().catch(() => null))

  if (!parsed.success)
    throw new OpenRouterError({ message: 'Invalid job response', status: res.status })

  return parsed.data
}

/** Returns the raw content response. The caller streams and closes it. */
interface FetchVideoContentParams {
  id: string
  index?: number
  fallback?: MockContentFallback
}

export async function fetchVideoContent(params: FetchVideoContentParams): Promise<Response> {
  const { id, index = 0, fallback } = params

  if (isMockMode()) return mockContent(id, fallback)

  const res = await request({
    url: `${BASE_URL}/api/v1/videos/${encodeURIComponent(id)}/content?index=${index}`,
    init: { headers: headers(false), cache: 'no-store' },
    timeoutMs: FETCH_TIMEOUTS.content,
  })

  if (!res.ok) throw await errorFromResponse(res)

  return res
}

interface RequestParams {
  url: string
  init: RequestInit
  timeoutMs: number
}

/** Runs an outbound call. Aborts become retryable status 0 errors. */
async function request(params: RequestParams): Promise<Response> {
  const { url, init, timeoutMs } = params

  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    if (error instanceof OpenRouterError) throw error

    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new OpenRouterError({ message: 'Request timed out', status: 0 })
    }

    throw error
  }
}

function headers(isJson: boolean): Record<string, string> {
  const key = getSecret('OPENROUTER_API_KEY')

  if (isNil(key) || key === '')
    throw new OpenRouterError({
      message: 'OpenRouter key is not set. Open Settings.',
      status: 401,
      code: 'no_key',
    })

  const result: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'Unplatform AI',
  }

  if (isJson) result['Content-Type'] = 'application/json'

  return result
}

/** Provider detail from `error.metadata`, never headers or the request body. */
export async function errorFromResponse(res: Response): Promise<OpenRouterError> {
  const payload: unknown = await res.json().catch(() => null)
  const error = isRecord(payload) ? payload.error : undefined
  const normalized = normalizeBase(readErrorMessage(error) ?? res.statusText, res.status)
  const detail = providerDetail(error)
  const base = normalized.message === '' ? `HTTP ${res.status}` : normalized.message

  return new OpenRouterError({
    message: detail === '' ? base : `${base} (${detail})`,
    status: res.status,
    code: normalized.code ?? codeValue(errorCode(error)),
  })
}

function readErrorMessage(error: unknown): string | null {
  return isRecord(error) && isString(error.message) ? error.message : null
}

function errorCode(error: unknown): unknown {
  return isRecord(error) ? error.code : undefined
}

function providerDetail(error: unknown): string {
  const meta = isRecord(error) && isRecord(error.metadata) ? error.metadata : null

  if (isNil(meta)) return ''

  const rawText = isString(meta.raw) ? meta.raw : null
  const raw = rawText?.slice(0, PROVIDER_RAW_MAX_CHARS) ?? null
  const provider = isString(meta.provider_name) ? meta.provider_name : null

  return [provider, raw].filter(Boolean).join(': ')
}

/** Removes repeated `HTTP <status>:` and `<status>:` prefixes. */
export function stripStatusPrefix(message: string, status: number): string {
  return message.replace(new RegExp(`^(?:(?:HTTP\\s+)?${status}:\\s*)+`, 'i'), '').trim()
}

/** Unwraps a JSON error body nested in the provider message, at most twice. */
function normalizeBase(input: string, status: number): { message: string; code?: string } {
  let message = input
  let code: string | undefined

  for (let pass = 0; pass < 2; pass += 1) {
    message = stripStatusPrefix(message, status)
    const error = innerError(message)

    if (!error) break

    code = codeValue(error.code) ?? code
    message = isString(error.message) ? error.message : ''
  }

  return { message, code }
}

function innerError(message: string): Record<string, unknown> | null {
  if (!message.startsWith('{')) return null

  try {
    const parsed: unknown = JSON.parse(message)

    if (!isRecord(parsed)) return null

    return isRecord(parsed.error) ? parsed.error : parsed
  } catch {
    return null
  }
}

function codeValue(value: unknown): string | undefined {
  return isString(value) || typeof value === 'number' ? String(value) : undefined
}
