import { readFile } from 'node:fs/promises'

import { omit } from 'lodash-es'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { isBlockedEntry } from '@/features/generator/model/model-row-props'
import type { ImageCapabilities } from '@/server/providers/openrouter/image-capabilities'
import {
  fetchImageEndpointsResult,
  fetchImageModelList,
} from '@/server/providers/openrouter/images-models'
import type { EndpointSignal, ProviderImageModel } from '@/server/providers/types'
import { catalogStatus } from '@/server/services/catalog-status'

import { primaryBinding } from '../src/core/presets/common/bindings'
import { IMAGE_PRESETS } from '../src/core/presets/image'

const MODELS_URL = 'https://openrouter.ai/api/v1/images/models'

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

      if (url.includes('/images/models/') && url.endsWith('/endpoints')) {
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

function fixtureProvider(models: readonly ProviderImageModel[], endpoint: EndpointSignal) {
  return {
    id: 'openrouter' as const,
    listModels: async () => {
      return { models, isFresh: true }
    },
    listEndpoints: async () => {
      return endpoint
    },
  }
}

function capabilitiesOf(model: ProviderImageModel | undefined): ImageCapabilities | null {
  if (model === undefined) {
    return null
  }

  return omit(model, 'modelId')
}

function absentBinding(): ReturnType<typeof primaryBinding> {
  return { ...primaryBinding(IMAGE_PRESETS[0]), modelId: 'custom/absent' }
}

describe('captured image catalog', () => {
  it('marks every image preset available or unverified and keeps nano banana 2.1 available', async () => {
    stubFixtureFetch({ models: await fixture('images-models.json') })

    const list = await fetchImageModelList(true)
    const provider = fixtureProvider(list.models, { state: 'not_found', reason: 'HTTP 404' })
    const statuses = new Map<string, string>()

    for (const preset of IMAGE_PRESETS) {
      const status = await catalogStatus({
        provider,
        binding: primaryBinding(preset),
        label: 'OpenRouter',
      })

      statuses.set(preset.id, status.status)
      expect(['available', 'unverified'], preset.id).toContain(status.status)
    }

    expect(statuses.get('gemini-nano-banana-2.1')).toBe('available')
  })

  it('keeps a bad params entry listed with null capabilities and one warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    stubFixtureFetch({
      models: {
        data: [
          {
            id: 'bad/params',
            supported_parameters: {
              resolution: { type: 'enum', values: ['1K'] },
              n: 'not-a-range',
            },
          },
        ],
      },
    })

    const list = await fetchImageModelList(true)

    const model = list.models.find((item) => {
      return item.modelId === 'bad/params'
    })

    const capabilities = capabilitiesOf(model)

    expect(model).toBeDefined()
    expect(capabilities).toMatchObject({ resolutions: ['1K'], maxN: null })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('n')
  })
})

// eslint-disable-next-line max-lines-per-function -- status cases share one fixture provider
describe('captured image catalog status', () => {
  it('keeps an absent model with endpoints unverified and Generate enabled', async () => {
    stubFixtureFetch({ models: { data: [] } })

    const list = await fetchImageModelList(true)
    const provider = fixtureProvider(list.models, { state: 'present', reason: null })

    const status = await catalogStatus({
      provider,
      binding: absentBinding(),
      label: 'OpenRouter',
    })

    expect(status.status).toBe('unverified')

    expect(
      isBlockedEntry({
        modelId: 'custom/absent',
        presetId: 'absent',
        provider: 'openrouter',
        status: status.status,
        reason: status.reason,
        pricing: null,
        source: {
          kind: 'openrouter',
          instanceId: 'openrouter',
          badge: null,
          workflowName: null,
          local: false,
        },
      }),
    ).toBe(false)
  })

  it('marks an absent model with a 404 endpoint as missing and blocks Generate', async () => {
    stubFixtureFetch({ models: { data: [] } })

    const list = await fetchImageModelList(true)
    const provider = fixtureProvider(list.models, { state: 'not_found', reason: 'HTTP 404' })

    const status = await catalogStatus({
      provider,
      binding: absentBinding(),
      label: 'OpenRouter',
    })

    expect(status.status).toBe('missing')
    expect(status.reason).toBe('Not available on OpenRouter right now.')

    expect(
      isBlockedEntry({
        modelId: 'custom/absent',
        presetId: 'absent',
        provider: 'openrouter',
        status: status.status,
        reason: status.reason,
        pricing: null,
        source: {
          kind: 'openrouter',
          instanceId: 'openrouter',
          badge: null,
          workflowName: null,
          local: false,
        },
      }),
    ).toBe(true)
  })

  it('follows a second page of the model list', async () => {
    stubFixtureFetch({
      models: { data: [] },
      onModelPage: (page) => {
        if (page === 1) {
          return {
            data: [{ id: 'page/one' }],
            links: { next: `${MODELS_URL}?page=2` },
          }
        }

        return { data: [{ id: 'page/two' }] }
      },
    })

    const list = await fetchImageModelList(true)

    expect(
      list.models.map((model) => {
        return model.modelId
      }),
    ).toEqual(['page/one', 'page/two'])

    expect(list.isFresh).toBe(true)
  })

  it('parses the id and endpoints response shape', async () => {
    stubFixtureFetch({
      models: { data: [] },
      endpoints: await fixture('gemini-3.1-flash-image-endpoints.json'),
    })

    const result = await fetchImageEndpointsResult('google/gemini-3.1-flash-image', true)

    expect(result.state).toBe('present')
    expect(result.reason).toBeNull()
    expect(result.endpoints).toHaveLength(3)

    expect(result.endpoints[0]?.model).toMatchObject({
      resolutions: ['512', '1K', '2K', '4K'],
      maxN: 1,
      referenceMax: 14,
    })
  })
})
