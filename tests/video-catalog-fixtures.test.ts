import { readFile } from 'node:fs/promises'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { VIDEO_PRESETS } from '@/core/presets'
import { primaryBinding } from '@/core/presets/common/bindings'
import { listModels } from '@/server/providers/openrouter/models'
import {
  fetchVideoEndpoints,
  fetchVideoModelsResult,
} from '@/server/providers/openrouter/video-models'
import type { EndpointSignal, ProviderModelList } from '@/server/providers/types'
import { catalogStatus } from '@/server/services/catalog-status'

const MODELS_URL = 'https://openrouter.ai/api/v1/videos/models'
const ENDPOINTS_URL = 'https://openrouter.ai/api/v1/models'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function fixture(name: string): Promise<unknown> {
  const text = await readFile(new URL(`./fixtures/openrouter/${name}`, import.meta.url), 'utf8')

  return JSON.parse(text)
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function notFound(): Response {
  return new Response('missing', { status: 404 })
}

interface FixtureFetchParams {
  models: unknown
  endpoints?: unknown
  onModelPage?: (page: number) => unknown
}

function stubFixtureFetch(params: FixtureFetchParams): void {
  const { models, endpoints, onModelPage } = params
  let page = 0

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input)

      if (url.startsWith(`${ENDPOINTS_URL}/`) && url.endsWith('/endpoints')) {
        return endpoints === undefined ? notFound() : json(endpoints)
      }

      if (!url.startsWith(MODELS_URL)) {
        return notFound()
      }

      page += 1

      return json(onModelPage?.(page) ?? models)
    }),
  )
}

interface FixtureProvider {
  id: 'openrouter'
  listModels(): Promise<ProviderModelList>
  listEndpoints(modelId: string): Promise<EndpointSignal>
}

function fixtureProvider(list: ProviderModelList, endpoint: EndpointSignal): FixtureProvider {
  return {
    id: 'openrouter',
    listModels: async () => {
      return list
    },
    listEndpoints: async () => {
      return endpoint
    },
  }
}

function absentBinding(): ReturnType<typeof primaryBinding> {
  return { ...primaryBinding(VIDEO_PRESETS[0]), modelId: 'custom/absent' }
}

/** Primes the shared list cache so the adapter reads the stubbed response. */
async function loadFixtureList(): Promise<ProviderModelList> {
  const { reason } = await fetchVideoModelsResult(true)

  expect(reason).toBeNull()

  return listModels()
}

describe('captured video catalog', () => {
  it('never marks a video preset missing from the captured catalog', async () => {
    stubFixtureFetch({ models: await fixture('videos-models.json') })

    const list = await loadFixtureList()
    const provider = fixtureProvider(list, { state: 'present', reason: null })
    const statuses = new Map<string, string>()

    for (const preset of VIDEO_PRESETS) {
      const status = await catalogStatus({
        provider,
        binding: primaryBinding(preset),
        label: 'OpenRouter',
      })

      statuses.set(preset.id, status.status)

      if (status.status === 'unverified') {
        console.warn(`${preset.id} unverified: ${status.reason ?? 'no endpoint reason'}`)
      }
    }

    for (const preset of VIDEO_PRESETS) {
      expect(statuses.get(preset.id), preset.id).not.toBe('missing')
    }
  })

  it('keeps an absent video model with endpoints unverified', async () => {
    stubFixtureFetch({ models: { data: [] } })

    const list = await loadFixtureList()
    const provider = fixtureProvider(list, { state: 'present', reason: null })

    const status = await catalogStatus({
      provider,
      binding: absentBinding(),
      label: 'OpenRouter',
    })

    expect(status.status).toBe('unverified')
  })

  it('marks an absent video model with a 404 endpoint missing', async () => {
    stubFixtureFetch({ models: { data: [] } })

    const list = await loadFixtureList()
    const provider = fixtureProvider(list, { state: 'not_found', reason: 'HTTP 404' })

    const status = await catalogStatus({
      provider,
      binding: absentBinding(),
      label: 'OpenRouter',
    })

    expect(status.status).toBe('missing')
    expect(status.reason).toBe('Not available on OpenRouter right now.')
  })

  it('parses the captured video endpoints response', async () => {
    stubFixtureFetch({
      models: { data: [] },
      endpoints: await fixture('seedance-2.0-endpoints.json'),
    })

    const result = await fetchVideoEndpoints('bytedance/seedance-2.0', true)

    expect(result.state).toBe('present')
    expect(result.reason).toBeNull()
  })
})
