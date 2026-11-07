import { describe, expect, it } from 'vitest'

import { MEDIA_KINDS } from '../src/core/media/media-types'
import { aspectAllowed } from '../src/core/media/output-size'
import { minDuration, VIDEO_PRESETS } from '../src/core/presets'
import { primaryBinding } from '../src/core/presets/common/bindings'
import type { VideoPreset } from '../src/core/presets/video/types'
import { skuKey } from '../src/core/pricing/sku'

/** Every key the preset can produce for its allowed inputs. */
function pricingKeys(preset: VideoPreset): string[] {
  return preset.resolutions.flatMap((resolution) => {
    return [true, false].flatMap((isAudio) => {
      return [true, false].map((hasVideoInput) => {
        return skuKey(primaryBinding(preset).pricing, { resolution, audio: isAudio, hasVideoInput })
      })
    })
  })
}

/** Per-family expectations the contract pins. Custom presets arrive with the adapters. */
const FAMILY_CONTRACT: Partial<Record<VideoPreset['family'], { idPrefix: string; icon: string }>> =
  {
    wan: { idPrefix: 'wan-', icon: 'sparkles' },
    seedance: { idPrefix: 'seedance-', icon: 'audio-lines' },
  }

describe('preset contract', () => {
  it('keeps defaults inside their lists', () => {
    for (const preset of VIDEO_PRESETS) {
      const min = minDuration(preset)

      expect(preset.aspectRatios, preset.id).toContain(preset.defaultAspectRatio)
      expect(preset.resolutions, preset.id).toContain(preset.defaultResolution)
      expect(preset.duration.default, preset.id).toBeGreaterThanOrEqual(min)
      expect(preset.duration.default, preset.id).toBeLessThanOrEqual(preset.duration.max)

      if (preset.duration.options) {
        expect(preset.duration.options, preset.id).toContain(preset.duration.default)
      }
    }
  })

  it('keeps every duration option inside min and max', () => {
    for (const preset of VIDEO_PRESETS) {
      const min = minDuration(preset)

      for (const option of preset.duration.options ?? []) {
        expect(option, `${preset.id} ${option}s`).toBeGreaterThanOrEqual(min)
        expect(option, `${preset.id} ${option}s`).toBeLessThanOrEqual(preset.duration.max)
      }
    }
  })

  it('has a size for every allowed aspect and resolution pair', () => {
    for (const preset of VIDEO_PRESETS) {
      if (!preset.outputSizes) {
        continue
      }

      for (const resolution of preset.resolutions) {
        for (const aspect of preset.aspectRatios) {
          const isAllowed = aspectAllowed({ preset, resolution, aspect })
          const isSized = Boolean(preset.outputSizes[resolution]?.[aspect])

          expect(isSized, `${preset.id} ${resolution} ${aspect}`).toBe(isAllowed)
        }
      }
    }
  })

  it('has a fallback for every SKU key pricing can return', () => {
    for (const preset of VIDEO_PRESETS) {
      for (const key of pricingKeys(preset)) {
        expect(primaryBinding(preset).pricing.fallback[key], `${preset.id} ${key}`).toBeDefined()
      }
    }
  })

  it('declares a reference video billing factor', () => {
    for (const preset of VIDEO_PRESETS) {
      expect(primaryBinding(preset).pricing.referenceVideoFactor, preset.id).toBeGreaterThanOrEqual(
        0,
      )
    }
  })

  it('has limits for every enabled reference kind', () => {
    for (const preset of VIDEO_PRESETS) {
      for (const kind of MEDIA_KINDS) {
        if (preset.references[kind] === 0) {
          continue
        }

        expect(preset.referenceLimits?.[kind], `${preset.id} ${kind}`).toBeDefined()
      }
    }
  })

  it('sets family and icon', () => {
    for (const preset of VIDEO_PRESETS) {
      const contract = FAMILY_CONTRACT[preset.family]

      expect(preset.id.startsWith(contract?.idPrefix ?? ''), preset.id).toBe(true)
      expect(preset.icon, preset.id).toBe(contract?.icon)
    }
  })

  it('has unique ids and slugs', () => {
    const ids = VIDEO_PRESETS.map((preset) => {
      return preset.id
    })

    const slugs = VIDEO_PRESETS.map((preset) => {
      return primaryBinding(preset).modelId
    })

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})
