import { describe, expect, it } from 'vitest'

import { IMAGE_COUNT_MAX } from '../src/core/constants'
import type { ImageOutput, ImageRecord } from '../src/core/schemas/image-record'
import { imageItems, itemAspect, videoItem } from '../src/lib/feed/output-items'
import { savedImageItems } from '../src/lib/feed/picker-items'
import { record } from './helpers/history'

const RECORD_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const OUTPUT_A = '3f2504e0-4f89-41d3-9a0c-0305e82c3302'
const OUTPUT_B = '3f2504e0-4f89-41d3-9a0c-0305e82c3303'
const OUTPUT_C = '3f2504e0-4f89-41d3-9a0c-0305e82c3304'
const OUTPUT_D = '3f2504e0-4f89-41d3-9a0c-0305e82c3305'

const pendingOutput = (id: string, index: number): ImageOutput => {
  return { id, index, status: 'pending' }
}

const savedOutput = (id: string, index: number, isFavorite: boolean): ImageOutput => {
  return {
    id,
    index,
    status: 'saved',
    file: `image-${index}.png`,
    mediaType: 'image/png',
    width: 1024,
    height: 768,
    bytes: 2048,
    favorite: isFavorite,
    seed: null,
  }
}

function imageRecord(overrides: Partial<ImageRecord> = {}): ImageRecord {
  return {
    id: RECORD_ID,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'completed',
    provider: 'openrouter',
    preset: { id: 'nano-banana-2', title: 'Nano Banana', slug: 'nano-banana-2' },
    input: {
      presetId: 'nano-banana-2',
      prompt: 'a cat',
      count: 2,
      aspectRatio: '3:2',
      resolution: '1K',
      quality: null,
      background: null,
      references: [],
      seed: null,
    },
    outputs: [savedOutput(OUTPUT_A, 0, true), savedOutput(OUTPUT_B, 1, false)],
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd: 0.02,
      actualUsd: 0.02,
      priceSource: 'mock',
      billed: true,
    },
    ...overrides,
  }
}

describe('video grid items', () => {
  it('keeps one item per record and maps the video fields', () => {
    const source = record('video-1')
    const item = videoItem(source)

    expect(item.id).toBe('video-1')
    expect(item.recordId).toBe('video-1')
    expect(item.recordKind).toBe('video')
    expect(item.canSelect).toBe(true)
    expect(item.mediaSrc).toBe('/api/media/downloads/video-1.mp4')
    expect(item.source).toBe(source)
  })
})

describe('image grid items', () => {
  it('makes one item per output and keys favorites by output id', () => {
    const source = imageRecord()
    const items = imageItems(source)

    expect(items).toHaveLength(2)

    expect(
      items.map((item) => {
        return item.id
      }),
    ).toEqual([OUTPUT_A, OUTPUT_B])

    expect(
      items.map((item) => {
        return item.recordId
      }),
    ).toEqual([RECORD_ID, RECORD_ID])

    expect(
      items.map((item) => {
        return item.favorite
      }),
    ).toEqual([true, false])

    expect(items[0]?.status).toBe('completed')
    expect(items[0]?.thumbSrc).toBe('/api/thumbs/images/image-0.png?w=320')
    expect(items[0]?.width).toBe(1024)
    expect(items[0]?.canSelect).toBe(true)
  })

  it('maps a failed output without a file', () => {
    const source = imageRecord({
      outputs: [{ id: OUTPUT_B, index: 0, status: 'failed', error: 'Rejected' }],
    })

    const [item] = imageItems(source)

    expect(item?.status).toBe('failed')
    expect(item?.thumbSrc).toBe('')
  })

  it('renders count placeholders at the requested aspect for a pending record', () => {
    const source = imageRecord({
      status: 'submitting',
      input: { ...imageRecord().input, count: IMAGE_COUNT_MAX, aspectRatio: '3:2' },
      outputs: [],
    })

    const items = imageItems(source)
    const first = items[0]

    expect(items).toHaveLength(IMAGE_COUNT_MAX)

    expect(
      items.every((item) => {
        return item.status === 'submitting'
      }),
    ).toBe(true)

    expect(first?.width).toBe(3)
    expect(first?.height).toBe(2)

    expect(
      items.map((item) => {
        return item.id
      }),
    ).toEqual([`${RECORD_ID}:0`, `${RECORD_ID}:1`, `${RECORD_ID}:2`, `${RECORD_ID}:3`])
  })

  it('uses a square placeholder for auto', () => {
    const source = imageRecord({
      status: 'saving',
      input: { ...imageRecord().input, aspectRatio: 'auto' },
      outputs: [],
    })

    const [first] = imageItems(source)

    expect(first?.width).toBe(1)
    expect(first?.height).toBe(1)
  })
})

describe('image cost share', () => {
  it('divides the record cost across the saved or planned outputs', () => {
    const saved = imageItems(imageRecord())

    expect(
      saved.map((item) => {
        return item.costUsd
      }),
    ).toEqual([0.01, 0.01])

    const pending = imageItems(
      imageRecord({
        status: 'submitting',
        outputs: [],
        input: { ...imageRecord().input, count: 4 },
        cost: { ...imageRecord().cost, actualUsd: null, estimatedUsd: 0.08 },
      }),
    )

    expect(
      pending.map((item) => {
        return item.costUsd
      }),
    ).toEqual([0.02, 0.02, 0.02, 0.02])
  })
})

describe('liked image items', () => {
  it('keeps only the liked output in the liked feed and the liked picker tab', () => {
    const source = imageRecord({
      outputs: [
        savedOutput(OUTPUT_A, 0, true),
        savedOutput(OUTPUT_B, 1, false),
        savedOutput(OUTPUT_C, 2, false),
        savedOutput(OUTPUT_D, 3, false),
      ],
    })

    const feed = imageItems(source, true)
    const picker = savedImageItems([source], true)

    expect(feed).toHaveLength(1)
    expect(feed[0]?.id).toBe(OUTPUT_A)
    expect(picker).toHaveLength(1)
    expect(picker[0]?.id).toBe(OUTPUT_A)
  })
})

describe('pending image outputs', () => {
  it('keeps the planned id for a pending output', () => {
    const source = imageRecord({
      status: 'saving',
      outputs: [pendingOutput(OUTPUT_A, 0), pendingOutput(OUTPUT_B, 1)],
    })

    const items = imageItems(source)

    expect(
      items.map((item) => {
        return item.id
      }),
    ).toEqual([OUTPUT_A, OUTPUT_B])

    expect(items[0]?.status).toBe('saving')
    expect(items[0]?.thumbSrc).toBe('')
  })

  it('keeps the same id when a pending output becomes saved', () => {
    const pending = imageItems(
      imageRecord({ status: 'saving', outputs: [pendingOutput(OUTPUT_A, 0)] }),
    )

    const saved = imageItems(imageRecord({ outputs: [savedOutput(OUTPUT_A, 0, false)] }))

    expect(saved[0]?.id).toBe(pending[0]?.id)
    expect(saved[0]?.id).toBe(OUTPUT_A)
  })
})

describe('itemAspect', () => {
  it('uses output pixels first, then the requested ratio', () => {
    const [image] = imageItems(imageRecord())
    const video = videoItem(record('video-1'))

    expect(image === undefined ? 0 : itemAspect(image)).toBeCloseTo(4 / 3)
    expect(itemAspect(video)).toBeCloseTo(16 / 9)
  })
})

describe('image selection rules', () => {
  it('selects a failed output', () => {
    const source = imageRecord({
      outputs: [{ id: OUTPUT_B, index: 0, status: 'failed', error: 'Rejected' }],
    })

    const [item] = imageItems(source)

    expect(item?.canSelect).toBe(true)
  })

  it('selects a terminal placeholder and locks pending outputs', () => {
    const failed = imageRecord({ status: 'failed', outputs: [] })

    const pending = imageRecord({
      status: 'saving',
      outputs: [pendingOutput(OUTPUT_B, 0)],
    })

    expect(imageItems(failed)[0]?.canSelect).toBe(true)
    expect(imageItems(pending)[0]?.canSelect).toBe(false)
  })
})
