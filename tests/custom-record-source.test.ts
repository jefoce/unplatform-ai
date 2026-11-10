import { describe, expect, it } from 'vitest'

import { getPreset } from '@/core/presets'
import type { VideoPreset } from '@/core/presets/video/types'
import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'
import { customRunPriceFromUsd, resolveCustomRunPrice } from '@/server/providers/custom/pricing'
import { customRecordSource } from '@/server/providers/custom/record-source'

const ENDPOINT: CustomEndpoint = {
  id: 'ep1',
  label: 'Studio PC',
  badge: 'CU3',
  baseUrl: 'http://127.0.0.1:8188',
  enabled: true,
  pricing: { mode: 'model', usd: 0 },
  instanceId: 'pack-1',
  lastHealth: null,
}

function videoPreset(perRunUsd: number): VideoPreset {
  return {
    ...getPreset('wan-3.0'),
    id: 'custom.ep1.wan22',
    title: 'Local Wan',
    bindings: [
      {
        provider: 'custom',
        modelId: 'wan22',
        pricing: { formula: 'perRun', skuRules: [], fallback: { run: perRunUsd } },
        transport: { image: 'base64', video: 'base64', audio: 'base64' },
      },
    ],
  }
}

describe('custom record source', () => {
  it('snapshots the endpoint and the workflow at create time', () => {
    const preset = { ...videoPreset(0), workflowName: 'wan22.json' } as VideoPreset
    const source = customRecordSource(preset, ENDPOINT)

    expect(source).toEqual({
      kind: 'custom',
      instanceId: 'ep1',
      badge: 'CU3',
      presetTitle: 'Local Wan',
      workflowName: 'wan22.json',
      endpointLabel: 'Studio PC',
      local: true,
    })
  })
})

describe('custom run price', () => {
  it('reads the endpoint override', () => {
    const preset = videoPreset(3)

    expect(resolveCustomRunPrice({ endpoint: ENDPOINT, preset, duration: 5 })).toBe(3)

    expect(
      resolveCustomRunPrice({
        endpoint: { ...ENDPOINT, pricing: { mode: 'free', usd: 0 } },
        preset,
        duration: 5,
      }),
    ).toBe(0)

    expect(
      resolveCustomRunPrice({
        endpoint: { ...ENDPOINT, pricing: { mode: 'perRun', usd: 2 } },
        preset,
        duration: 5,
      }),
    ).toBe(2)

    expect(
      resolveCustomRunPrice({
        endpoint: { ...ENDPOINT, pricing: { mode: 'perSecond', usd: 0.5 } },
        preset,
        duration: 4,
      }),
    ).toBe(2)
  })

  it('falls back to the model run price', () => {
    expect(resolveCustomRunPrice({ endpoint: ENDPOINT, preset: videoPreset(3), duration: 1 })).toBe(
      3,
    )
  })
})

describe('custom run price from usd', () => {
  it('keeps the model price in model or null mode', () => {
    expect(customRunPriceFromUsd({ pricing: null, modelUsd: 1.5, seconds: 3 })).toBe(1.5)

    expect(
      customRunPriceFromUsd({ pricing: { mode: 'model', usd: 9 }, modelUsd: 1.5, seconds: 3 }),
    ).toBe(1.5)
  })

  it('applies the override and bills at least one second', () => {
    expect(
      customRunPriceFromUsd({ pricing: { mode: 'free', usd: 9 }, modelUsd: 1.5, seconds: 3 }),
    ).toBe(0)

    expect(
      customRunPriceFromUsd({ pricing: { mode: 'perRun', usd: 2 }, modelUsd: 1.5, seconds: 3 }),
    ).toBe(2)

    expect(
      customRunPriceFromUsd({
        pricing: { mode: 'perSecond', usd: 0.5 },
        modelUsd: 1.5,
        seconds: 4,
      }),
    ).toBe(2)

    expect(
      customRunPriceFromUsd({
        pricing: { mode: 'perSecond', usd: 0.5 },
        modelUsd: 1.5,
        seconds: 0,
      }),
    ).toBe(0.5)
  })
})
