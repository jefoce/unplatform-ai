import 'server-only'

import { isNil } from 'lodash-es'
import { z } from 'zod'

import { FETCH_TIMEOUTS } from '@/core/constants'
import { messageOf } from '@/core/errors'
import { isNonEmptyString } from '@/core/guards'
import type { ModelPreset } from '@/core/presets/types'
import { asJobStatus } from '@/core/submit-state'
import type { PricingInfo, TestResult } from '@/core/types'

import { getSecret } from '../../secrets'
import type {
  AccountLookupParams,
  ContentRequest,
  JobRef,
  JobSnapshot,
  JobUsage,
  ProviderAccount,
  SubmitJobParams,
  SubmittedJob,
  VideoProvider,
} from '../types'
import { getProviderAccount } from './account'
import { buildRequestBody } from './body'
import { OpenRouterError } from './error'
import { classifyOpenRouterError } from './errors'
import {
  BASE_URL,
  errorFromResponse,
  headers,
  JobSchema,
  request,
  SubmitSchema,
  type VideoJobResponse,
  type VideoJobUsage,
} from './http'
import { listModels } from './models'
import { getPricing as getPresetPricing } from './pricing'

const KeyDataSchema = z.object({ label: z.string().nullish() }).loose()

const KeySchema = z.object({ data: KeyDataSchema }).loose()

/** OpenRouter adapter. */
export function createOpenRouterProvider(): VideoProvider {
  return {
    id: 'openrouter',
    isConfigured,
    submit,
    getJob,
    fetchContent,
    getAccount,
    getPricing,
    listModels,
    testConnection,
  }
}

function isConfigured(): boolean {
  return isNonEmptyString(getSecret('OPENROUTER_API_KEY'))
}

async function submit(params: SubmitJobParams): Promise<SubmittedJob> {
  const { preset, input, media } = params
  const body = buildRequestBody({ input, preset, media })

  try {
    const res = await request({
      url: `${BASE_URL}/api/v1/videos`,
      init: {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify(body),
      },
      timeoutMs: FETCH_TIMEOUTS.submit,
    })

    if (!res.ok) {
      throw await errorFromResponse(res)
    }

    const parsed = SubmitSchema.safeParse(
      await res.json().catch(() => {
        return null
      }),
    )

    if (!parsed.success) {
      throw new OpenRouterError({ message: 'Invalid submit response', status: res.status })
    }

    return toSubmitted(parsed.data)
  } catch (error) {
    return rethrowClassified(error)
  }
}

interface SubmittedResponse {
  id: string
  status: string
}

function toSubmitted(job: SubmittedResponse): SubmittedJob {
  return { jobId: job.id, status: asJobStatus(job.status) ?? 'pending' }
}

async function getJob(job: JobRef): Promise<JobSnapshot> {
  try {
    const res = await request({
      url: `${BASE_URL}/api/v1/videos/${encodeURIComponent(job.jobId)}`,
      init: {
        headers: headers(false),
        cache: 'no-store',
      },
      timeoutMs: FETCH_TIMEOUTS.poll,
    })

    if (!res.ok) {
      throw await errorFromResponse(res)
    }

    const parsed = JobSchema.safeParse(
      await res.json().catch(() => {
        return null
      }),
    )

    if (!parsed.success) {
      throw new OpenRouterError({ message: 'Invalid job response', status: res.status })
    }

    return toSnapshot(parsed.data)
  } catch (error) {
    return rethrowClassified(error)
  }
}

function toSnapshot(job: VideoJobResponse): JobSnapshot {
  const usage = toUsage(job.usage)

  return {
    status: asJobStatus(job.status) ?? 'pending',
    generationId: job.generation_id ?? null,
    expiresAt: toExpiresAt(job.expires_at),
    urls: job.urls ?? null,
    usage,
    error: job.error ?? null,
  }
}

async function fetchContent(params: ContentRequest): Promise<Response> {
  const { job, index } = params

  try {
    const res = await request({
      url: `${BASE_URL}/api/v1/videos/${encodeURIComponent(job.jobId)}/content?index=${index}`,
      init: { headers: headers(false), cache: 'no-store' },
      timeoutMs: FETCH_TIMEOUTS.content,
    })

    if (!res.ok) {
      throw await errorFromResponse(res)
    }

    return res
  } catch (error) {
    return rethrowClassified(error)
  }
}

function getAccount(params?: AccountLookupParams): Promise<ProviderAccount> {
  return getProviderAccount(params)
}

function getPricing(preset: ModelPreset, isForce?: boolean): Promise<PricingInfo> {
  return getPresetPricing(preset, isForce)
}

async function testConnection(): Promise<TestResult> {
  const key = getSecret('OPENROUTER_API_KEY')

  if (!isNonEmptyString(key)) {
    return { ok: false, error: 'OpenRouter key is not set. Open Settings.' }
  }

  try {
    const res = await fetch(`${BASE_URL}/api/v1/key`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
    })

    if (!res.ok) {
      return { ok: false, error: `OpenRouter ${res.status} ${res.statusText}` }
    }

    const parsed = KeySchema.safeParse(
      await res.json().catch(() => {
        return null
      }),
    )

    const label = parsed.success ? parsed.data.data.label : undefined

    if (!isNonEmptyString(label)) {
      return { ok: true }
    }

    return { ok: true, label }
  } catch (error) {
    return { ok: false, error: messageOf(error, 'Test failed') }
  }
}

function toUsage(usage: VideoJobUsage | null | undefined): JobUsage | null {
  if (isNil(usage)) {
    return null
  }

  return { costUsd: usage.cost ?? null, isByok: usage.is_byok ?? null, usesEstimatedCost: false }
}

function toExpiresAt(value: number | null | undefined): number | null {
  if (isNil(value)) {
    return null
  }

  return value * 1000
}

function rethrowClassified(error: unknown): never {
  throw classifyOpenRouterError(error)
}
