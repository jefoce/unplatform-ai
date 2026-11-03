import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UploadsById } from '@/core/api/uploads'
import { imageReferenceMax } from '@/features/image-generator/preset'
import { useImageGeneratorStore } from '@/features/image-generator/store'

import { IMAGE_COUNT_MAX } from '../src/core/constants'
import { IMAGE_PRESETS } from '../src/core/presets/image'
import { GEMINI_25_FLASH_IMAGE } from '../src/core/presets/image/gemini/gemini-2.5-flash-image'
import { GEMINI_31_FLASH_IMAGE } from '../src/core/presets/image/gemini/gemini-3.1-flash-image'
import { GEMINI_31_FLASH_LITE } from '../src/core/presets/image/gemini/gemini-3.1-flash-lite-image'
import { GPT_IMAGE_2 } from '../src/core/presets/image/openai/gpt-image-2'
import { GPT_IMAGE_25_FLARE } from '../src/core/presets/image/openai/gpt-image-2.5-flare'
import { SEEDREAM_5_FLASH } from '../src/core/presets/image/seedream/seedream-5-0-flash'
import { SEEDREAM_5_LITE } from '../src/core/presets/image/seedream/seedream-5-0-lite'
import type { ImageGenerationInput } from '../src/core/schemas/image-record'
import { upload, uploadsOf } from './helpers/validation-fixtures'

const mocks = vi.hoisted(() => {
  return { toast: vi.fn() }
})

vi.mock('sonner', () => {
  return { toast: mocks.toast }
})

interface DraftOverrides extends Partial<ImageGenerationInput> {
  uploadsById?: UploadsById
}

function resetDraft(overrides: DraftOverrides = {}): void {
  useImageGeneratorStore.setState({
    presetId: SEEDREAM_5_FLASH.id,
    prompt: 'A cat',
    count: 1,
    aspectRatio: '1:1',
    resolution: '1K',
    quality: null,
    background: null,
    references: [],
    seed: null,
    uploadsById: {},
    ...overrides,
  })
}

beforeEach(() => {
  resetDraft()
  mocks.toast.mockReset()
})

describe('image preset switch', () => {
  it('trims references to the new cap and toasts', () => {
    const references = Array.from({ length: 14 }, (_, index) => {
      return `reference-${index}`
    })

    const uploads = uploadsOf(
      ...references.map((id) => {
        return upload(id, 'image')
      }),
    )

    resetDraft({ references, uploadsById: uploads })

    useImageGeneratorStore.getState().setPreset(GEMINI_25_FLASH_IMAGE.id)

    const state = useImageGeneratorStore.getState()

    expect(state.references).toEqual(references.slice(0, GEMINI_25_FLASH_IMAGE.referenceMax))
    expect(state.uploadsById).toEqual(uploads)
    expect(mocks.toast).toHaveBeenCalledWith('Kept the first 3 references')
  })

  it('keeps a supported aspect ratio and resets an unsupported one', () => {
    resetDraft({ aspectRatio: '16:9' })
    useImageGeneratorStore.getState().setPreset(SEEDREAM_5_LITE.id)

    expect(useImageGeneratorStore.getState().aspectRatio).toBe('16:9')

    resetDraft({ aspectRatio: 'auto' })
    useImageGeneratorStore.getState().setPreset(GEMINI_25_FLASH_IMAGE.id)

    expect(useImageGeneratorStore.getState().aspectRatio).toBe(
      GEMINI_25_FLASH_IMAGE.defaultAspectRatio,
    )
  })

  it('falls back to the default when the new preset does not list the resolution', () => {
    resetDraft({ resolution: '2K' })
    useImageGeneratorStore.getState().setPreset(GEMINI_31_FLASH_LITE.id)

    expect(useImageGeneratorStore.getState().resolution).toBe(
      GEMINI_31_FLASH_LITE.defaultResolution,
    )
  })

  it('keeps a supported resolution', () => {
    resetDraft({ resolution: '2K' })
    useImageGeneratorStore.getState().setPreset(GEMINI_31_FLASH_IMAGE.id)

    expect(useImageGeneratorStore.getState().resolution).toBe('2K')
  })

  it('drops the resolution when the new preset has no control', () => {
    resetDraft({ resolution: '2K' })
    useImageGeneratorStore.getState().setPreset(GEMINI_25_FLASH_IMAGE.id)

    expect(useImageGeneratorStore.getState().resolution).toBeNull()
  })

  it('keeps quality and background when the new preset lists them', () => {
    resetDraft({ presetId: GPT_IMAGE_2.id, quality: 'high', background: 'opaque' })
    useImageGeneratorStore.getState().setPreset(GPT_IMAGE_25_FLARE.id)

    const state = useImageGeneratorStore.getState()

    expect(state.quality).toBe('high')
    expect(state.background).toBe('opaque')
  })

  it('resets quality and background when the new preset does not list them', () => {
    resetDraft({
      presetId: GPT_IMAGE_25_FLARE.id,
      quality: 'max',
      background: 'transparent',
    })

    useImageGeneratorStore.getState().setPreset(GPT_IMAGE_2.id)

    const state = useImageGeneratorStore.getState()

    expect(state.quality).toBe(GPT_IMAGE_2.defaultQuality)
    expect(state.background).toBe(GPT_IMAGE_2.defaultBackground)
  })

  it('keeps the prompt, clamps the count and drops the seed for a preset without seed', () => {
    resetDraft({ prompt: 'A dog', count: IMAGE_COUNT_MAX + 5, seed: 42 })
    useImageGeneratorStore.getState().setPreset(GEMINI_25_FLASH_IMAGE.id)

    const state = useImageGeneratorStore.getState()

    expect(state.prompt).toBe('A dog')
    expect(state.count).toBe(IMAGE_COUNT_MAX)
    expect(state.seed).toBeNull()
  })

  it('keeps the seed when the new preset supports it', () => {
    resetDraft({ seed: 42 })
    useImageGeneratorStore.getState().setPreset(SEEDREAM_5_LITE.id)

    expect(useImageGeneratorStore.getState().seed).toBe(42)
  })
})

describe('image preset switch reference caps', () => {
  it('trims to the new cap for every ordered pair that lowers the reference limit', () => {
    let pairs = 0

    for (const from of IMAGE_PRESETS) {
      for (const to of IMAGE_PRESETS) {
        if (to.referenceMax >= from.referenceMax) {
          continue
        }

        pairs += 1

        const references = Array.from({ length: imageReferenceMax(from) }, (_, index) => {
          return `reference-${index}`
        })

        const uploads = uploadsOf(
          ...references.map((id) => {
            return upload(id, 'image')
          }),
        )

        resetDraft({
          presetId: from.id,
          count: IMAGE_COUNT_MAX,
          references,
          uploadsById: uploads,
        })

        mocks.toast.mockClear()
        useImageGeneratorStore.getState().setPreset(to.id)

        const state = useImageGeneratorStore.getState()
        const cap = imageReferenceMax(to)

        expect(state.references, `${from.id} -> ${to.id}`).toEqual(references.slice(0, cap))
        expect(state.count, `${from.id} -> ${to.id}`).toBe(IMAGE_COUNT_MAX)

        expect(mocks.toast, `${from.id} -> ${to.id}`).toHaveBeenCalledWith(
          `Kept the first ${cap} references`,
        )
      }
    }

    expect(pairs).toBeGreaterThan(0)
  })
})
