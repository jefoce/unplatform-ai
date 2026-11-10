import 'server-only'

import { isNil } from 'lodash-es'

import { SEED_MAX } from '@/core/constants'
import { planImageCalls } from '@/core/plan-image-calls'
import type { ImagePreset } from '@/core/presets/image/types'
import type { ImageRecord } from '@/core/schemas/image-record'

import { getEndpointSync } from '../providers/custom/endpoint-source'
import { endpointRemovedError } from '../providers/custom/errors'
import { instanceIdOf } from '../providers/custom/record-instance'
import { ProviderError, providerStatusOf } from '../providers/provider-error'
import { getImageProvider } from '../providers/registry'
import type { ImageReferencePayload, ImageResultItem, JobRef } from '../providers/types'
import { recordHealthFromError, recordHealthOk } from '../services/endpoint-health'

export interface PlannedCall {
  start: number
  count: number
}

export interface CallOutcome extends PlannedCall {
  items: readonly ImageResultItem[]
  costUsd: number | null
  error: string | null
  errorStatus?: number
  isUncertain: boolean
  job?: JobRef
}

export interface PreparedImage {
  record: ImageRecord
  preset: ImagePreset
  references: ImageReferencePayload[]
}

interface SubmitCallParams {
  prepared: PreparedImage
  call: PlannedCall
}

/** One seed per image, wrapping at `SEED_MAX`. */
export function seedForImage(baseSeed: number | null, index: number): number | null {
  if (isNil(baseSeed)) {
    return null
  }

  return (baseSeed + index) % (SEED_MAX + 1)
}

export function plannedCalls(record: ImageRecord, preset: ImagePreset): PlannedCall[] {
  let start = 0

  return planImageCalls(record.input.count, preset).map((count) => {
    const call = { start, count }

    start += count

    return call
  })
}

export function isUncertain(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true
  }

  if (!(error instanceof ProviderError)) {
    return false
  }

  return error.kind === 'timeout' || error.kind === 'charged_unknown'
}

export function errorText(error: unknown): string {
  if (error instanceof ProviderError) {
    if (error.message === '') {
      return `HTTP ${error.status}`
    }

    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Image generation failed'
}

function failedOutcome(call: PlannedCall, error: unknown): CallOutcome {
  return {
    ...call,
    items: [],
    costUsd: null,
    error: errorText(error),
    errorStatus: providerStatusOf(error),
    isUncertain: isUncertain(error),
  }
}

export async function submitCall(params: SubmitCallParams): Promise<CallOutcome> {
  const { prepared, call } = params
  const { record, preset, references } = prepared
  const instanceId = instanceIdOf(record)

  if (record.provider === 'custom' && isNil(getEndpointSync(instanceId))) {
    return failedOutcome(call, endpointRemovedError())
  }

  try {
    let seed: number | null = null

    if (preset.seed) {
      seed = seedForImage(record.seedUsed, call.start)
    }

    const result = await getImageProvider(instanceId).generate({
      preset,
      input: { ...record.input, count: call.count, seed },
      references,
    })

    if (record.provider === 'custom') {
      recordHealthOk(instanceId)
    }

    return {
      ...call,
      items: result.items,
      costUsd: result.costUsd,
      error: null,
      isUncertain: false,
      job: result.job,
    }
  } catch (error) {
    if (record.provider === 'custom') {
      recordHealthFromError({
        endpointId: instanceId,
        error,
        source: 'job',
        isJobRunning: true,
      })
    }

    return failedOutcome(call, error)
  }
}
