import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { getPreset } from '../src/core/presets'
import { primaryBinding } from '../src/core/presets/common/bindings'
import type { ImagePreset } from '../src/core/presets/image/types'
import type { VideoPreset } from '../src/core/presets/video/types'
import { quote, type VideoQuoteContext } from '../src/core/pricing/quote'
import type { PricingConfig } from '../src/core/pricing/types'
import { imagePreset } from './helpers/image-presets'

const ROOT = path.join(os.tmpdir(), `cf-pricing-per-run-${process.pid}-${Date.now()}`)
const DATA = path.join(ROOT, 'data')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

const RUN_PRICING: PricingConfig = {
  formula: 'perRun',
  skuRules: [],
  fallback: { per_run: 0.5 },
}

function withVideoPricing(pricing: PricingConfig): VideoPreset {
  const base = getPreset('wan-3.0')

  return {
    ...base,
    bindings: [{ ...primaryBinding(base), pricing }],
  }
}

function withImagePricing(pricing: PricingConfig): ImagePreset {
  const base = imagePreset('flux-3-image-klein')

  return {
    ...base,
    bindings: [{ ...base.bindings[0], pricing }],
  }
}

function videoContext(duration = 5): VideoQuoteContext {
  return {
    kind: 'video',
    resolution: '720p',
    aspect: '16:9',
    audio: true,
    hasVideoInput: false,
    duration,
    referenceSeconds: 0,
  }
}

async function writeEndpoints(mode: string, usd: number): Promise<void> {
  const endpoint = {
    id: 'ep-1',
    label: 'Studio',
    badge: 'CU1',
    baseUrl: 'http://127.0.0.1:8188',
    enabled: true,
    pricing: { mode, usd },
    instanceId: null,
    lastHealth: null,
  }

  await fs.mkdir(DATA, { recursive: true })

  await fs.writeFile(
    path.join(DATA, 'endpoints.json'),
    JSON.stringify({ version: 1, endpoints: [endpoint], badgeCounter: 1 }),
  )
}

beforeEach(async () => {
  await fs.rm(DATA, { recursive: true, force: true })
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

describe('perRun quote', () => {
  it('quotes one flat price for a video run', () => {
    const preset = withVideoPricing(RUN_PRICING)

    const result = quote({
      preset,
      binding: preset.bindings[0],
      ctx: videoContext(5),
    })

    expect(result?.total).toBe(0.5)
    expect(result?.perUnit).toBe(0.1)
    expect(result?.unit).toBe('run')
  })

  it('quotes one flat price for an image run', () => {
    const preset = withImagePricing(RUN_PRICING)

    const result = quote({
      preset,
      binding: preset.bindings[0],
      ctx: {
        kind: 'image',
        count: 4,
        calls: 1,
        aspectRatio: '1:1',
        resolution: null,
        quality: null,
        background: null,
        references: 0,
        promptChars: 0,
      },
    })

    expect(result?.total).toBe(0.5)
    expect(result?.perUnit).toBe(0.125)
    expect(result?.unit).toBe('run')
  })

  it('prices a missing key at 0 instead of returning null', () => {
    const preset = withVideoPricing({ ...RUN_PRICING, fallback: {} })
    const result = quote({ preset, binding: preset.bindings[0], ctx: videoContext() })

    expect(result?.total).toBe(0)
  })
})

describe('endpoint override', () => {
  it('reads the endpoint id from the custom preset id', async () => {
    const { endpointIdFromPresetId } = await import('../src/core/presets/custom')

    expect(endpointIdFromPresetId('custom.ep-1.wf.model')).toBe('ep-1')
    expect(endpointIdFromPresetId('wan-3.0')).toBeNull()
  })

  it('uses the model price in model mode', async () => {
    await writeEndpoints('model', 9)

    const { resolveRunPricing } = await import('../src/server/pricing/endpoints')

    const pricing = await resolveRunPricing({
      presetId: 'custom.ep-1.wf.model',
      pricing: RUN_PRICING,
      seconds: 5,
    })

    expect(pricing.fallback.per_run).toBe(0.5)
  })

  it('hides the price in free mode', async () => {
    await writeEndpoints('free', 9)

    const { resolveRunPricing } = await import('../src/server/pricing/endpoints')

    const pricing = await resolveRunPricing({
      presetId: 'custom.ep-1.wf.model',
      pricing: RUN_PRICING,
      seconds: 5,
    })

    expect(pricing.fallback.per_run).toBe(0)
  })

  it('prefers the perRun override over the model price', async () => {
    await writeEndpoints('perRun', 2)

    const { resolveRunPricing } = await import('../src/server/pricing/endpoints')

    const pricing = await resolveRunPricing({
      presetId: 'custom.ep-1.wf.model',
      pricing: RUN_PRICING,
      seconds: 5,
    })

    const preset = withVideoPricing(pricing)
    const result = quote({ preset, binding: preset.bindings[0], ctx: videoContext(5) })

    expect(result?.total).toBe(2)
    expect(result?.unit).toBe('run')
  })

  it('scales a perSecond override by billed seconds', async () => {
    await writeEndpoints('perSecond', 0.25)

    const { resolveRunPricing } = await import('../src/server/pricing/endpoints')

    const pricing = await resolveRunPricing({
      presetId: 'custom.ep-1.wf.model',
      pricing: RUN_PRICING,
      seconds: 4,
    })

    expect(pricing.fallback.per_run).toBe(1)
  })

  it('keeps the model price when the endpoint file or endpoint is missing', async () => {
    const { resolveRunPricing } = await import('../src/server/pricing/endpoints')

    const missingFile = await resolveRunPricing({
      presetId: 'custom.ep-1.wf.model',
      pricing: RUN_PRICING,
      seconds: 5,
    })

    await writeEndpoints('free', 0)

    const missingEndpoint = await resolveRunPricing({
      presetId: 'custom.ep-2.wf.model',
      pricing: RUN_PRICING,
      seconds: 5,
    })

    expect(missingFile.fallback.per_run).toBe(0.5)
    expect(missingEndpoint.fallback.per_run).toBe(0.5)
  })

  it('leaves other formulas untouched', async () => {
    await writeEndpoints('free', 0)

    const { resolveRunPricing } = await import('../src/server/pricing/endpoints')
    const perSecond: PricingConfig = { formula: 'perSecond', skuRules: [], fallback: { x: 1 } }

    const pricing = await resolveRunPricing({
      presetId: 'custom.ep-1.wf.model',
      pricing: perSecond,
      seconds: 5,
    })

    expect(pricing).toBe(perSecond)
  })
})
