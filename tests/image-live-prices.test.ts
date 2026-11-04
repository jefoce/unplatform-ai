import { isNil } from 'lodash-es'
import { describe, expect, it } from 'vitest'

import { IMAGE_PRESETS } from '../src/core/presets/image'
import LIVE_PRICES from './fixtures/image-live-prices.json'

/**
 * Recorded by the catalog-drift job. Each key is the highest endpoint rate for
 * that billable/variant/unit, so a preset fallback can be checked exactly.
 */
const FIXTURE: Record<string, Record<string, number>> = LIVE_PRICES

function liveFor(modelId: string): Record<string, number> {
  const live = FIXTURE[modelId]

  if (isNil(live)) {
    throw new Error(`no live price fixture for ${modelId}`)
  }

  return live
}

/** Exact comparison so a one-unit price edit cannot hide inside a tolerance. */
function assertRates(
  presetId: string,
  fallback: Record<string, number>,
  live: Record<string, number>,
): void {
  for (const [key, rate] of Object.entries(fallback)) {
    expect(live[key], `${presetId} ${key} missing live`).toBeDefined()
    expect(rate, `${presetId} ${key}`).toBe(live[key])
  }
}

describe('image live prices', () => {
  for (const preset of IMAGE_PRESETS) {
    it(`matches the recorded fixture for ${preset.id}`, () => {
      const live = liveFor(preset.bindings[0].modelId)
      const fallback = preset.bindings[0].pricing.fallback

      assertRates(preset.id, fallback, live)

      for (const [key, rate] of Object.entries(live)) {
        if (rate === 0) {
          continue
        }

        expect(fallback[key], `${preset.id} ${key} missing fallback`).toBeDefined()
      }
    })
  }

  it('rejects a fallback rate that differs from the fixture', () => {
    const preset = IMAGE_PRESETS[0]
    const live = liveFor(preset.bindings[0].modelId)
    const [key, rate] = Object.entries(live)[0] ?? []
    const wrong = { ...preset.bindings[0].pricing.fallback, [key ?? 'rate']: (rate ?? 0) + 1e-6 }

    expect(() => {
      assertRates(preset.id, wrong, live)
    }).toThrow()
  })

  it('keeps the highest endpoint rate for gemini-3.1-flash-image', () => {
    const live = liveFor('google/gemini-3.1-flash-image')

    expect(live.output_image_base_token).toBe(0.000066)
  })

  it('maps high_resolution to 2K only on seedream-5-0-pro', () => {
    for (const preset of IMAGE_PRESETS) {
      const hasHighResolution =
        'output_image_high_resolution_image' in preset.bindings[0].pricing.fallback

      expect(hasHighResolution, preset.id).toBe(preset.id === 'seedream-5-0-pro')
    }
  })
})
