import { vi } from 'vitest'

const GEMINI_WIDE = [
  '1:1',
  '1:4',
  '1:8',
  '2:3',
  '3:2',
  '3:4',
  '4:1',
  '4:3',
  '4:5',
  '5:4',
  '8:1',
  '9:16',
  '16:9',
  '21:9',
]

const GEMINI_STANDARD = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']

const SEEDREAM_RATIOS = [
  '1:1',
  '1:2',
  '2:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '9:19.5',
  '19.5:9',
  '9:20',
  '20:9',
  '9:21',
  '21:9',
  'auto',
]

const GPT_RATIOS = ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9', 'auto']

const FLUX_RATIOS = [
  '21:9',
  '2:1',
  '16:9',
  '3:2',
  '7:5',
  '4:3',
  '5:4',
  '1:1',
  '4:5',
  '3:4',
  '5:7',
  '2:3',
  '9:16',
  '1:2',
  '9:21',
  'auto',
]

const GPT_QUALITIES = ['auto', 'low', 'medium', 'high', 'xhigh', 'max']

interface LiveSpec {
  id: string
  resolutions: string[] | null
  aspectRatios: string[]
  qualities?: string[]
  backgrounds?: string[]
  maxN: number
  referenceMax: number
  seed: boolean
}

export const GEMINI_21: LiveSpec = {
  id: 'google/gemini-nano-banana-2.1',
  resolutions: ['1K', '2K', '4K'],
  aspectRatios: GEMINI_WIDE,
  maxN: 1,
  referenceMax: 14,
  seed: false,
}

const MODELS: LiveSpec[] = [
  GEMINI_21,
  {
    id: 'google/gemini-3.1-flash-lite-image',
    resolutions: ['1K'],
    aspectRatios: GEMINI_WIDE,
    maxN: 1,
    referenceMax: 14,
    seed: false,
  },
  {
    id: 'google/gemini-3.1-flash-image',
    resolutions: ['512', '1K', '2K', '4K'],
    aspectRatios: GEMINI_WIDE,
    maxN: 1,
    referenceMax: 14,
    seed: false,
  },
  {
    id: 'google/gemini-3-pro-image',
    resolutions: ['1K', '2K', '4K'],
    aspectRatios: GEMINI_STANDARD,
    maxN: 1,
    referenceMax: 14,
    seed: false,
  },
  {
    id: 'google/gemini-2.5-flash-image',
    resolutions: null,
    aspectRatios: GEMINI_STANDARD,
    maxN: 1,
    referenceMax: 3,
    seed: false,
  },
  {
    id: 'bytedance-seed/seedream-5-0-flash',
    resolutions: ['1K', '2K'],
    aspectRatios: SEEDREAM_RATIOS,
    maxN: 1,
    referenceMax: 14,
    seed: true,
  },
  {
    id: 'bytedance-seed/seedream-5-0-lite',
    resolutions: ['2K', '4K'],
    aspectRatios: SEEDREAM_RATIOS,
    maxN: 4,
    referenceMax: 14,
    seed: true,
  },
  {
    id: 'bytedance-seed/seedream-5-0-pro',
    resolutions: ['1K', '2K'],
    aspectRatios: SEEDREAM_RATIOS,
    maxN: 1,
    referenceMax: 14,
    seed: true,
  },
  {
    id: 'openai/gpt-image-2.5-sunburst',
    resolutions: null,
    aspectRatios: GPT_RATIOS,
    qualities: GPT_QUALITIES,
    backgrounds: ['auto', 'transparent', 'opaque'],
    maxN: 10,
    referenceMax: 16,
    seed: false,
  },
  {
    id: 'openai/gpt-image-2.5-flare',
    resolutions: null,
    aspectRatios: GPT_RATIOS,
    qualities: GPT_QUALITIES,
    backgrounds: ['auto', 'transparent', 'opaque'],
    maxN: 10,
    referenceMax: 16,
    seed: false,
  },
  {
    id: 'openai/gpt-image-2',
    resolutions: null,
    aspectRatios: GPT_RATIOS,
    qualities: ['auto', 'low', 'medium', 'high'],
    backgrounds: ['auto', 'opaque'],
    maxN: 10,
    referenceMax: 16,
    seed: false,
  },
  {
    id: 'black-forest-labs/flux-3-image-klein',
    resolutions: ['768', '1K', '1.5K', '2K', '4K'],
    aspectRatios: FLUX_RATIOS,
    maxN: 1,
    referenceMax: 10,
    seed: false,
  },
]

function params(spec: LiveSpec): unknown {
  return {
    resolution: spec.resolutions,
    aspect_ratio: spec.aspectRatios,
    quality: spec.qualities ?? null,
    background: spec.backgrounds ?? null,
    n: { max: spec.maxN },
    references: { max: spec.referenceMax },
    input_references: { max: spec.referenceMax },
    seed: spec.seed,
  }
}

export function modelEntry(spec: LiveSpec): unknown {
  return { id: spec.id, supported_parameters: params(spec) }
}

/** Raw supported_parameters keys the live list reports for a model id. */
export function liveParamKeys(modelId: string): string[] {
  const spec = MODELS.find((item) => {
    return item.id === modelId
  })

  if (!spec) {
    return []
  }

  return Object.keys(params(spec) as Record<string, unknown>)
}

function endpointEntries(spec: LiveSpec): unknown[] {
  const pricing = [{ billable: 'output_image', unit: 'image', cost_usd: 0.01, variant: null }]

  if (spec.id === 'google/gemini-3-pro-image') {
    const narrow = { ...spec, resolutions: ['1K', '2K'] }

    return [
      { name: 'vertex', supported_parameters: params(narrow), pricing },
      { name: 'google', supported_parameters: params(spec), pricing },
    ]
  }

  return [{ name: 'openrouter', supported_parameters: params(spec), pricing }]
}

export function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

export function stubLive(specs: readonly LiveSpec[] = MODELS): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      return respond(input, specs)
    }),
  )
}

async function respond(
  input: string | URL | Request,
  specs: readonly LiveSpec[],
): Promise<Response> {
  const url = String(input)

  if (url.endsWith('/api/v1/images/models')) {
    return json({ data: specs.map(modelEntry) })
  }

  return respondEndpoint(url, specs)
}

function respondEndpoint(url: string, specs: readonly LiveSpec[]): Response {
  const spec = specs.find((item) => {
    return url.includes(item.id)
  })

  if (!spec) {
    return new Response('missing', { status: 404 })
  }

  return json({ data: { endpoints: endpointEntries(spec) } })
}
