// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { HistoryTile } from '@/features/history/list/HistoryTile'

import { ZOOM_DEFAULT } from '../src/core/constants'
import type { ImageOutput, ImageRecord } from '../src/core/schemas/image-record'
import { imageItems } from '../src/lib/feed/output-items'
import { handleNoop } from './helpers/history'
import { required } from './helpers/required'

const deleteImageOutput = vi.hoisted(() => {
  return vi.fn(() => {
    return Promise.resolve(undefined)
  })
})

const deleteImageRecord = vi.hoisted(() => {
  return vi.fn(() => {
    return Promise.resolve(undefined)
  })
})

vi.mock('@/lib/api/images', () => {
  return {
    cancelImageRequest: vi.fn(),
    deleteImageOutput,
    deleteImageRecord,
    revealImageOutput: vi.fn(),
    setOutputFavorite: vi.fn(),
  }
})

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: vi.fn() } }
})

const RECORD_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const OUTPUT_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3302'

interface RecordParams {
  status?: ImageRecord['status']
  error?: string
  outputs?: ImageOutput[]
}

function imageRecord(params: RecordParams = {}): ImageRecord {
  const createdAt = '2026-01-01T00:00:00.000Z'

  return {
    id: RECORD_ID,
    createdAt,
    updatedAt: createdAt,
    status: params.status ?? 'failed',
    provider: 'openrouter',
    preset: { id: 'gemini-3.1-flash-image', title: 'Nano Banana 2', slug: 'gemini' },
    input: {
      presetId: 'gemini-3.1-flash-image',
      prompt: 'a cat',
      count: 1,
      aspectRatio: '1:1',
      resolution: '1K',
      quality: null,
      background: null,
      references: [],
      seed: null,
    },
    outputs: params.outputs ?? [],
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd: 0,
      actualUsd: null,
      priceSource: 'unknown',
      billed: null,
    },
    ...(params.error === undefined ? {} : { error: params.error }),
  }
}

function tile(item: ReturnType<typeof imageItems>[number]) {
  return <HistoryTile item={item} zoom={ZOOM_DEFAULT} onOpen={handleNoop} mediaWidth={0} />
}

async function openMenu(): Promise<void> {
  fireEvent.pointerDown(screen.getByRole('button', { name: 'More actions' }), {
    button: 0,
    ctrlKey: false,
  })

  await screen.findByRole('menuitem', { name: 'Reuse prompt' })
}

afterEach(() => {
  cleanup()
  deleteImageOutput.mockClear()
  deleteImageRecord.mockClear()
})

describe('failed image tile', () => {
  it('shows the translated record error with regenerate, reuse and delete', async () => {
    const [item] = imageItems(imageRecord({ status: 'partial', error: 'Disk is full' }))

    render(tile(required(item, 'image item')))

    expect(screen.getByText('The disk is full.')).not.toBeNull()
    expect(screen.getByText('Free some space. The download retries every minute.')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Regenerate' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Delete' })).not.toBeNull()

    await openMenu()

    expect(screen.getByRole('menuitem', { name: 'Reuse prompt' })).not.toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull()
  })

  it('shows the output error through the provider rules and offers delete and reuse', async () => {
    const [item] = imageItems(
      imageRecord({
        status: 'failed',
        outputs: [{ id: OUTPUT_ID, index: 0, status: 'failed', error: 'Rejected' }],
      }),
    )

    render(tile(required(item, 'image item')))

    expect(screen.getByText('Generation failed')).not.toBeNull()
    expect(screen.getByText('Rejected')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Regenerate' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Delete' })).not.toBeNull()

    await openMenu()

    expect(screen.getByRole('menuitem', { name: 'Reuse prompt' })).not.toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull()
  })

  it('puts regenerate first and delete second', () => {
    const [item] = imageItems(imageRecord({ status: 'failed', error: 'Failed' }))

    render(tile(required(item, 'image item')))

    const labels = screen.getAllByRole('button').map((button) => {
      return button.getAttribute('aria-label')
    })

    expect(labels.indexOf('Regenerate')).toBeGreaterThanOrEqual(0)
    expect(labels.indexOf('Regenerate')).toBeLessThan(labels.indexOf('Delete'))
  })

  it('deletes the failed output after confirmation', async () => {
    const [item] = imageItems(imageRecord({ status: 'failed', error: 'Failed' }))

    render(tile(required(item, 'image item')))

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByText('Delete image?')).not.toBeNull()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(deleteImageRecord).toHaveBeenCalledWith(RECORD_ID)
    })
  })

  it('renders a liked image favorite badge at rest and hides it on hover', () => {
    const [item] = imageItems(
      imageRecord({
        status: 'completed',
        outputs: [
          {
            id: OUTPUT_ID,
            index: 0,
            status: 'saved',
            file: 'image-0.png',
            mediaType: 'image/png',
            width: 1024,
            height: 1024,
            bytes: 2048,
            favorite: true,
            seed: null,
          },
        ],
      }),
    )

    render(tile(required(item, 'image item')))

    const badge = required(screen.getByText('1').closest('button'), 'favorite badge')

    expect(badge.className).toContain('group-hover/card:opacity-0')
    expect(badge.className).not.toContain('pointer-events-none opacity-0')
  })
})

describe('history tile cursor', () => {
  it('uses the default cursor on a failed image tile', () => {
    const [item] = imageItems(imageRecord({ status: 'failed' }))

    render(
      <HistoryTile item={required(item, 'failed item')} zoom={0} onOpen={vi.fn()} mediaWidth={0} />,
    )

    expect(screen.getByRole('button', { name: 'Open image details' }).className).toContain(
      'cursor-default',
    )
  })

  it('uses the default cursor on a pending image tile', () => {
    const [item] = imageItems(imageRecord({ status: 'submitting' }))

    render(
      <HistoryTile
        item={required(item, 'pending item')}
        zoom={0}
        onOpen={vi.fn()}
        mediaWidth={0}
      />,
    )

    expect(screen.getByRole('button', { name: 'Open image details' }).className).toContain(
      'cursor-default',
    )
  })

  it('keeps the pointer cursor on a completed image tile', () => {
    const [item] = imageItems(
      imageRecord({
        status: 'completed',
        outputs: [
          {
            id: OUTPUT_ID,
            index: 0,
            status: 'saved',
            file: 'image-0.png',
            mediaType: 'image/png',
            width: 1024,
            height: 1024,
            bytes: 2048,
            favorite: false,
            seed: null,
          },
        ],
      }),
    )

    render(
      <HistoryTile
        item={required(item, 'completed item')}
        zoom={0}
        onOpen={vi.fn()}
        mediaWidth={0}
      />,
    )

    expect(screen.getByRole('button', { name: 'Open image details' }).className).toContain(
      'cursor-pointer',
    )
  })
})

describe('image tile corners', () => {
  it('uses square corners for a completed image tile', () => {
    const [item] = imageItems(
      imageRecord({
        status: 'completed',
        outputs: [
          {
            id: OUTPUT_ID,
            index: 0,
            status: 'saved',
            file: 'image-0.png',
            mediaType: 'image/png',
            width: 1024,
            height: 1024,
            bytes: 2048,
            favorite: false,
            seed: null,
          },
        ],
      }),
    )

    render(
      <HistoryTile item={required(item, 'image item')} zoom={0} onOpen={vi.fn()} mediaWidth={0} />,
    )

    const tile = screen.getByRole('button', { name: 'Open image details' })

    expect(tile.className).toContain('rounded-none')
    expect(tile.className).not.toContain('rounded-2xl')
  })
})
