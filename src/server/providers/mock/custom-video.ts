import 'server-only'

import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { primaryBinding } from '@/core/presets/common/bindings'
import type { VideoPreset } from '@/core/presets/video/types'
import type { PricingInfo } from '@/core/pricing/types'
import type { UpaiJobStatus } from '@/core/protocol/upai'
import { asJobStatus } from '@/core/submit-state'
import type { TestResult } from '@/core/types'

import { makeTestVideo } from '../../media/ffmpeg'
import type {
  ContentRequest,
  EndpointSignal,
  JobRef,
  JobSnapshot,
  JobUsage,
  ProviderAccount,
  ProviderModelList,
  SubmitJobParams,
  SubmittedJob,
  VideoProvider,
} from '../types'
import { customMockUnavailableError, customMockWorkflowInvalidError } from './custom-errors'
import { cancelCustomMockJob, customMockJobSnapshot, startCustomMockJob } from './custom-jobs'
import {
  type CustomMockCatalog,
  customMockCatalog,
  customMockEndpointSignal,
  type CustomMockOptions,
  customMockScenario,
  toProviderVideoModel,
} from './custom-models'

const TEST_VIDEO_WIDTH = 1280
const TEST_VIDEO_HEIGHT = 720

/** In-process upai/1 video adapter for `CUSTOM_ENDPOINT_MOCK=1`. */
export function createCustomMockVideoProvider(options: CustomMockOptions): VideoProvider {
  const scenario = customMockScenario(options)

  return {
    id: 'custom',
    contentHosts: [],
    isConfigured,
    submit,
    getJob,
    cancel,
    fetchContent,
    getAccount,
    getPricing,
    listModels,
    listEndpoints,
    testConnection,
  }

  function catalog(): CustomMockCatalog {
    return customMockCatalog({ scenario })
  }

  function assertReachable(): void {
    if (catalog().isReachable) {
      return
    }

    throw customMockUnavailableError()
  }

  async function submit(params: SubmitJobParams): Promise<SubmittedJob> {
    assertReachable()
    assertValidPrompt(params.input.prompt)

    const started = startCustomMockJob({
      instanceId: options.instanceId,
      kind: 'video',
      modelId: primaryBinding(params.preset).modelId,
      prompt: params.input.prompt,
    })

    return { jobId: started.jobId, status: 'pending' }
  }

  async function getJob(job: JobRef): Promise<JobSnapshot> {
    assertReachable()

    const snapshot = customMockJobSnapshot(job)

    return {
      status: asJobStatus(snapshot.status) ?? 'pending',
      generationId: null,
      expiresAt: snapshot.expiresAt,
      urls: snapshot.urls,
      usage: usageOf(snapshot.status, snapshot.usageCost),
      error: snapshot.error,
      progress: {
        percent: snapshot.percent,
        queuePosition: snapshot.queuePosition,
        waitingOn: snapshot.waitingOn,
      },
    }
  }

  async function cancel(job: JobRef): Promise<void> {
    assertReachable()
    cancelCustomMockJob(job)
  }

  async function fetchContent(params: ContentRequest): Promise<Response> {
    assertReachable()

    return mockVideoContent(params)
  }

  async function listModels(): Promise<ProviderModelList> {
    const current = catalog()

    return {
      models: current.video.map(toProviderVideoModel),
      isFresh: current.isReachable,
    }
  }

  async function listEndpoints(modelId: string): Promise<EndpointSignal> {
    return customMockEndpointSignal({ catalog: catalog(), modelId })
  }

  async function testConnection(): Promise<TestResult> {
    if (!catalog().isReachable) {
      return { ok: false, error: 'ComfyUI is not reachable. Start ComfyUI, then try again.' }
    }

    return { ok: true, mock: true }
  }
}

function isConfigured(): boolean {
  return true
}

function assertValidPrompt(prompt: string): void {
  if (!prompt.includes('[invalid]')) {
    return
  }

  throw customMockWorkflowInvalidError()
}

function usageOf(status: UpaiJobStatus, costUsd: number): JobUsage | null {
  if (status !== 'completed') {
    return null
  }

  return { costUsd, isByok: false, usesEstimatedCost: false }
}

async function getAccount(): Promise<ProviderAccount> {
  return {
    balance: null,
    keyLimitRemaining: null,
    keyLimit: null,
    usageDaily: null,
    usageMonthly: null,
    source: 'mock',
    fetchedAt: new Date().toISOString(),
    error: null,
  }
}

async function getPricing(preset: VideoPreset): Promise<PricingInfo> {
  const listSkus = { ...primaryBinding(preset).pricing.fallback }

  return {
    skus: { ...listSkus },
    listSkus,
    discount: 0,
    source: 'mock',
    fetchedAt: new Date().toISOString(),
  }
}

async function mockVideoContent(params: ContentRequest): Promise<Response> {
  const duration = Math.max(1, params.fallback?.duration ?? 5)
  const file = path.join(os.tmpdir(), `custom-mock-${randomUUID()}.mp4`)

  try {
    await makeTestVideo(file, {
      width: TEST_VIDEO_WIDTH,
      height: TEST_VIDEO_HEIGHT,
      durationSec: duration,
    })

    const bytes = await fs.readFile(file)

    return new Response(Uint8Array.from(bytes), { headers: { 'content-type': 'video/mp4' } })
  } finally {
    await fs.unlink(file).catch(() => {})
  }
}
