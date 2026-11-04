/* eslint-disable max-lines -- contract cases stay in one suite */

import { isNil } from 'lodash-es'
import { describe, expect, it } from 'vitest'

import {
  IMAGE_ESTIMATE_URL,
  type ImageEstimateKey,
  imageEstimateKey,
  IMAGES_KEY,
} from '@/lib/api/swr-keys'
import { imageOutputPath, imageRecordPath, IMAGES_DIR, imageTempPath } from '@/server/paths'

import {
  type ImageBatchBody,
  ImageBatchSchema,
  type ImageEstimateBody,
  ImageEstimateSchema,
  type ImageFavoriteBody,
  ImageFavoriteSchema,
  type ImageListQuery,
  ImageListQuerySchema,
  type ImageListResult,
  type ImageSubmitBody,
  ImageSubmitSchema,
} from '../src/core/api/image'
import {
  HISTORY_PAGE_SIZE,
  IMAGE_COUNT_MAX,
  IMAGE_GRID_GAP,
  IMAGE_REFERENCE_MAX_MB,
  IMAGE_REFERENCE_MAX_SIDE_PX,
  IMAGE_ROW_MAX_HEIGHT,
  IMAGE_ROW_OVERSCAN,
  IMAGE_SUBMIT_PARALLEL,
} from '../src/core/constants'
import {
  type GridItem,
  type GridItemStatus,
  RECORD_KINDS,
  type RecordKind,
} from '../src/core/feed/grid-item'
import {
  type JustifyRowsParams,
  type MasonryItem,
  type MasonryRow,
  type MasonryRowItem,
} from '../src/core/feed/masonry-types'
import type { PickerModel } from '../src/core/feed/picker-model'
import type { BindingBase } from '../src/core/presets/common/binding'
import { DEFAULT_IMAGE_PRESET_ID, findImagePreset, IMAGE_PRESETS } from '../src/core/presets/image'
import {
  IMAGE_ASPECT_RATIOS,
  IMAGE_BACKGROUNDS,
  IMAGE_FAMILIES,
  IMAGE_QUALITIES,
  IMAGE_RESOLUTIONS,
  type ImageAspectChoice,
  type ImageAspectRatio,
  type ImageBackground,
  type ImageFamily,
  type ImageOption,
  type ImagePreset,
  type ImageQuality,
  type ImageResolution,
} from '../src/core/presets/image/types'
import {
  IMAGE_BILLABLE_KINDS,
  type ImageBillableKind,
  type ImagePriceLine,
  PRICE_UNITS,
  type PriceQuote,
} from '../src/core/pricing/types'
import type { ProviderId } from '../src/core/providers/types'
import {
  IMAGE_OUTPUT_MEDIA_TYPES,
  IMAGE_OUTPUT_STATUSES,
  IMAGE_RECORD_STATUSES,
  type ImageCost,
  type ImageGenerationInput,
  ImageInputSchema,
  type ImageOutput,
  type ImageOutputMediaType,
  type ImageOutputStatus,
  type ImageRecord,
  ImageRecordSchema,
  type ImageRecordStatus,
} from '../src/core/schemas/image-record'
import type { ValidationIssue } from '../src/core/validation/common'
import { validateImageInput } from '../src/core/validation/image'

const PRESET = IMAGE_PRESETS[0]

const issue = (text: string): ValidationIssue => {
  return { type: 'text', text }
}

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const OUTPUT_UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3302'

const MINIMAL_RECORD = {
  id: UUID,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  status: 'completed',
  preset: {
    id: PRESET.id,
    title: PRESET.title,
    slug: 'nano-banana-2',
  },
  input: {
    presetId: PRESET.id,
    prompt: 'a cat',
    count: 1,
    aspectRatio: '1:1',
    resolution: '1K',
    quality: null,
    background: null,
    references: [],
    seed: null,
  },
  outputs: [],
  seedUsed: null,
  cost: {
    currency: 'USD',
    unit: 'token',
    estimatedUsd: 0.01,
    actualUsd: null,
    priceSource: 'fallback',
    billed: null,
  },
}

const SAVED_OUTPUT = {
  id: UUID,
  index: 0,
  status: 'saved',
  file: `${UUID}-0.png`,
  mediaType: 'image/png',
  width: 1024,
  height: 1024,
  bytes: 1234,
  favorite: false,
} as const

const FAILED_OUTPUT = {
  id: OUTPUT_UUID,
  index: 1,
  status: 'failed',
  error: 'Provider rejected the image',
} as const

const VALID_SUBMIT_BODY = {
  presetId: PRESET.id,
  prompt: 'a cat',
  count: 1,
  aspectRatio: '1:1',
  resolution: '1K',
  quality: null,
  background: null,
  references: [],
  seed: null,
}

const VALID_ESTIMATE_BODY = {
  presetId: PRESET.id,
  count: 1,
  aspectRatio: '1:1',
  resolution: '1K',
  quality: null,
  background: null,
  references: [],
  promptChars: 5,
}

const defaultInSet = <T extends string>(
  set: readonly ImageOption<T>[] | null,
  value: T | null,
): boolean => {
  if (isNil(set) || isNil(value)) {
    return isNil(set) && isNil(value)
  }

  return set.some((option) => {
    return option.value === value
  })
}

type ContractTypes = readonly [
  ProviderId,
  ImagePreset,
  ImageResolution,
  ImageAspectRatio,
  ImageAspectChoice,
  ImageQuality,
  ImageBackground,
  ImageFamily,
  ImageBillableKind,
  ImageOption<string>,
  readonly ImageOption<string>[],
  ImagePriceLine,
  BindingBase,
  ImageRecordStatus,
  ImageOutputStatus,
  ImageOutputMediaType,
  ImageOutput,
  ImageGenerationInput,
  ImageCost,
  ImageRecord,
  ImageListQuery,
  ImageListResult,
  ImageFavoriteBody,
  ImageBatchBody,
  ImageSubmitBody,
  ImageEstimateBody,
  PriceQuote,
  ImageEstimateKey,
  RecordKind,
  GridItemStatus,
  GridItem,
  PickerModel,
  MasonryItem,
  MasonryRowItem,
  MasonryRow,
  JustifyRowsParams,
]

const CONTRACT_TYPES: ContractTypes | null = null

describe('image registry', () => {
  it('registers the shipped presets', () => {
    expect(IMAGE_PRESETS.length).toBe(12)
    expect(findImagePreset(PRESET.id)).toBe(PRESET)
    expect(findImagePreset(DEFAULT_IMAGE_PRESET_ID)).not.toBeNull()
    expect(IMAGE_RESOLUTIONS).toContain(PRESET.defaultResolution)
    expect(IMAGE_ASPECT_RATIOS).toContain(PRESET.defaultAspectRatio)
    expect(IMAGE_FAMILIES).toContain(PRESET.family)

    expect(IMAGE_QUALITIES).toContain('high')
    expect(IMAGE_BACKGROUNDS).toContain('transparent')
    expect(PRICE_UNITS).toEqual(['image', 'token'])
    expect(IMAGE_BILLABLE_KINDS).toContain('output_image')
  })

  it('keeps every default inside its option set', () => {
    expect(defaultInSet(PRESET.resolutions, PRESET.defaultResolution)).toBe(true)

    expect(defaultInSet(PRESET.qualities, PRESET.defaultQuality)).toBe(true)

    expect(defaultInSet(PRESET.backgrounds, PRESET.defaultBackground)).toBe(true)
  })
})

describe('image schemas', () => {
  it('parses a stored image record and defaults the provider', () => {
    const parsed = ImageRecordSchema.parse(MINIMAL_RECORD)

    expect(parsed.provider).toBe('openrouter')
    expect(IMAGE_RECORD_STATUSES).toContain(parsed.status)
    expect(IMAGE_OUTPUT_STATUSES).toContain('saved')
    expect(IMAGE_OUTPUT_MEDIA_TYPES).toContain('image/png')
    expect(RECORD_KINDS).toContain('image')
  })

  it('parses saved and failed outputs as a union', () => {
    const parsed = ImageRecordSchema.parse({
      ...MINIMAL_RECORD,
      outputs: [SAVED_OUTPUT, FAILED_OUTPUT],
    })

    const failed = parsed.outputs.at(1)

    expect(parsed.outputs).toHaveLength(2)
    expect(parsed.outputs[0]).toMatchObject({ status: 'saved', width: 1024, height: 1024 })
    expect(failed).toEqual(FAILED_OUTPUT)
    expect(failed && 'file' in failed).toBe(false)
  })

  it('parses a pending output with its planned id', () => {
    const pending = { id: OUTPUT_UUID, index: 0, status: 'pending' } as const
    const parsed = ImageRecordSchema.parse({ ...MINIMAL_RECORD, outputs: [pending] })

    expect(parsed.outputs[0]).toEqual(pending)
    expect(IMAGE_OUTPUT_STATUSES).toContain('pending')
  })

  it('defaults the output seed for records written before it existed', () => {
    const parsed = ImageRecordSchema.parse({ ...MINIMAL_RECORD, outputs: [SAVED_OUTPUT] })

    expect(parsed.outputs[0]).toMatchObject({ status: 'saved', seed: null })
  })

  it('requires width and height on a saved output', () => {
    const { width: _width, ...withoutWidth } = SAVED_OUTPUT

    const parsed = ImageRecordSchema.safeParse({
      ...MINIMAL_RECORD,
      outputs: [withoutWidth],
    })

    expect(parsed.success).toBe(false)
  })

  it('strips the old record-level favorite', () => {
    const parsed = ImageRecordSchema.parse({ ...MINIMAL_RECORD, favorite: true })

    expect(parsed).not.toHaveProperty('favorite')
  })

  it('parses list, favorite and batch bodies', () => {
    expect(ImageListQuerySchema.parse({}).limit).toBe(HISTORY_PAGE_SIZE)
    expect(ImageFavoriteSchema.safeParse({ favorite: true }).success).toBe(true)

    expect(
      ImageBatchSchema.safeParse({
        action: 'delete',
        outputs: [{ recordId: UUID, outputId: OUTPUT_UUID }],
      }).success,
    ).toBe(true)

    expect(
      ImageBatchSchema.safeParse({
        action: 'delete',
        outputs: [{ recordId: UUID, outputId: null }],
      }).success,
    ).toBe(true)

    expect(ImageBatchSchema.safeParse({ action: 'delete', outputs: [] }).success).toBe(false)
  })

  it('accepts a valid submit body and rejects bad input', () => {
    expect(ImageSubmitSchema.safeParse(VALID_SUBMIT_BODY).success).toBe(true)
    expect(ImageSubmitSchema.safeParse({ ...VALID_SUBMIT_BODY, count: 5 }).success).toBe(false)
    expect(ImageSubmitSchema.safeParse({ ...VALID_SUBMIT_BODY, prompt: '' }).success).toBe(false)

    expect(
      ImageSubmitSchema.safeParse({ ...VALID_SUBMIT_BODY, references: ['not-a-uuid'] }).success,
    ).toBe(false)
  })

  it('accepts an estimate body without the prompt text', () => {
    expect(ImageEstimateSchema.safeParse(VALID_ESTIMATE_BODY).success).toBe(true)
  })
})

describe('image validation', () => {
  const fixtureInput = ImageInputSchema.parse(MINIMAL_RECORD.input)

  it('accepts a valid fixture input', () => {
    expect(validateImageInput(PRESET, fixtureInput)).toEqual([])
  })

  it('rejects a resolution outside the preset', () => {
    expect(validateImageInput(PRESET, { ...fixtureInput, resolution: '768' })).toEqual([
      issue('Resolution is not supported by this model'),
    ])
  })

  it('requires a resolution when the control is shown', () => {
    expect(validateImageInput(PRESET, { ...fixtureInput, resolution: null })).toEqual([
      issue('Choose a resolution'),
    ])
  })

  it('rejects a seed on a model without seed', () => {
    expect(validateImageInput(PRESET, { ...fixtureInput, seed: 5 })).toEqual([
      issue('This model does not take a seed'),
    ])
  })
})

describe('image shared contracts', () => {
  it('builds image paths and bounds', () => {
    expect([
      IMAGE_COUNT_MAX,
      IMAGE_SUBMIT_PARALLEL,
      IMAGE_GRID_GAP,
      IMAGE_ROW_MAX_HEIGHT,
      IMAGE_ROW_OVERSCAN,
      IMAGE_REFERENCE_MAX_SIDE_PX,
      IMAGE_REFERENCE_MAX_MB,
    ]).toEqual([4, 2, 4, 640, 2, 2048, 5])

    expect(imageRecordPath('x').endsWith('x.json')).toBe(true)
    expect(imageTempPath({ id: 'x', index: 1, ext: '.png' })).toContain('.tmp-')
    expect(imageOutputPath({ id: 'x', index: 2, ext: '.png' }).endsWith('x-2.png')).toBe(true)
    expect(IMAGES_DIR.endsWith('images')).toBe(true)
  })

  it('builds image SWR keys', () => {
    expect(imageEstimateKey('{}')[0]).toBe(IMAGE_ESTIMATE_URL)
    expect(IMAGES_KEY).toBe('/api/images')
  })

  it('compiles the shared contract types', () => {
    expect(CONTRACT_TYPES).toBeNull()
  })
})
