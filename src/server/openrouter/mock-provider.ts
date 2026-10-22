import 'server-only'

import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { isNil, isString } from 'lodash-es'

import { FETCH_TIMEOUTS, MOCK_GENERATE_MS, MOCK_QUEUE_MS } from '@/core/constants'
import { isRecord } from '@/core/guards'
import { outputSize } from '@/core/output-size'
import { MODEL_PRESETS } from '@/core/presets'

import { globalState } from '../global-state'
import { MOCK_REMOTE_PREFIX } from '../local-url'
import { makeTestVideo } from '../media/ffmpeg'
import type { VideoJobResponse } from './client'
import { OpenRouterError } from './error'

export interface MockContentFallback {
  presetId: string
  duration: number
  resolution: string
  aspectRatio: string
}

interface MockState {
  mockStart: Map<string, number>
  mockPrompt: Map<string, string>
  mockBody: Map<string, unknown>
}

const mockState = globalState<MockState>('mock', () => ({
  mockStart: new Map(),
  mockPrompt: new Map(),
  mockBody: new Map(),
}))

export async function mockSubmit(body: unknown): Promise<{ id: string; status: string }> {
  const links: string[] = []

  collectMockLinks(body, links)

  for (const link of links) await assertMockFetch(link)

  const shouldFail = JSON.stringify(body).includes('[fail]')
  const id = `${shouldFail ? 'mockfail' : 'mock'}-${randomUUID()}`
  const prompt = field(body, 'prompt')

  mockState.mockStart.set(id, Date.now())
  mockState.mockPrompt.set(id, isString(prompt) ? prompt : '')
  mockState.mockBody.set(id, body)

  return { id, status: 'pending' }
}

/** Fails the mock job when a generated link is not fetchable, as a provider would. */
async function assertMockFetch(link: string): Promise<void> {
  const status = await fetch(link, {
    method: 'HEAD',
    signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
  })
    .then((res) => res.status)
    .catch(() => 0)

  if (status !== 200)
    throw new OpenRouterError({ message: `Mock provider could not fetch ${link}`, status: 400 })
}

function collectMockLinks(value: unknown, out: string[]): void {
  if (Array.isArray(value)) {
    for (const child of value) collectMockLinks(child, out)

    return
  }

  if (!isRecord(value)) return

  for (const [key, child] of Object.entries(value)) {
    if (key === 'url' && isString(child)) {
      if (child.startsWith(MOCK_REMOTE_PREFIX)) out.push(child)

      continue
    }

    collectMockLinks(child, out)
  }
}

export function mockJob(id: string, submittedAt?: string): VideoJobResponse {
  const elapsed = Date.now() - mockStarted(id, submittedAt)

  if (elapsed < MOCK_QUEUE_MS) return { id, status: 'pending' }

  if (elapsed < MOCK_QUEUE_MS + MOCK_GENERATE_MS) return { id, status: 'in_progress' }

  if (id.startsWith('mockfail-')) return { id, status: 'failed', error: 'Mock failure' }

  return { id, status: 'completed', usage: { cost: 0, is_byok: false } }
}

function mockStarted(id: string, submittedAt?: string): number {
  const stored = mockState.mockStart.get(id)

  if (!isNil(stored)) return stored

  const parsed = isNil(submittedAt) || submittedAt === '' ? Number.NaN : Date.parse(submittedAt)

  return Number.isFinite(parsed) ? parsed : Date.now()
}

export async function mockContent(id: string, fallback?: MockContentFallback): Promise<Response> {
  const body = mockState.mockBody.get(id)
  const resolution = field(body, 'resolution') ?? fallback?.resolution
  const aspect = field(body, 'aspect_ratio') ?? fallback?.aspectRatio
  const rawDuration = field(body, 'duration') ?? fallback?.duration
  const duration = typeof rawDuration === 'number' ? rawDuration : 5
  const { width, height } = mockDimensions({
    model: field(body, 'model'),
    presetId: fallback?.presetId,
    resolution,
    aspect,
  })
  const file = path.join(os.tmpdir(), `wan-mock-${randomUUID()}.mp4`)

  try {
    await makeTestVideo(file, { width, height, durationSec: duration })
    const bytes = await fs.readFile(file)

    return new Response(Uint8Array.from(bytes), { headers: { 'content-type': 'video/mp4' } })
  } finally {
    await fs.unlink(file).catch(() => {})
  }
}

interface MockDimensionsParams {
  model: unknown
  presetId: unknown
  resolution: unknown
  aspect: unknown
}

/** Sizes the mock from the model slug or preset id, falling back to 720p 16:9. */
function mockDimensions(params: MockDimensionsParams): { width: number; height: number } {
  const { model, presetId, resolution, aspect } = params
  const preset =
    MODEL_PRESETS.find((item) => item.slug === model) ??
    MODEL_PRESETS.find((item) => item.id === presetId)
  const res = preset?.resolutions.find((item) => item === resolution)

  if (isNil(preset) || isNil(res)) return { width: 1280, height: 720 }

  const ratio = aspect === 'auto' ? undefined : preset.aspectRatios.find((item) => item === aspect)

  return (
    outputSize({ preset, resolution: res, aspect: ratio ?? preset.defaultAspectRatio }) ?? {
      width: 1280,
      height: 720,
    }
  )
}

function field(body: unknown, key: string): unknown {
  if (!isRecord(body)) return undefined

  return body[key]
}
