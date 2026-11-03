// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DetailsPanel } from '@/features/history/details/DetailsPanel'

import type { ImageRecord } from '../src/core/schemas/image-record'
import { imageItems } from '../src/lib/feed/output-items'
import { required } from './helpers/required'

const createImage = vi.hoisted(() => {
  return vi.fn()
})

const deleteImageOutput = vi.hoisted(() => {
  return vi.fn()
})

vi.mock('@/lib/api/images', () => {
  return {
    cancelImageRequest: vi.fn(),
    createImage,
    deleteImageOutput,
    deleteImageRecord: vi.fn(),
    refreshImages: vi.fn(),
    revealImageOutput: vi.fn(),
    setOutputFavorite: vi.fn(),
    useImageOutputAsFrame: vi.fn(),
  }
})

vi.mock('@/lib/api/generations', () => {
  return {
    createGeneration: vi.fn(),
    fetchUploadsByIds: vi.fn(),
  }
})

vi.mock('@/lib/api/credits', () => {
  return { refreshCredits: vi.fn() }
})

vi.mock('@/lib/fetcher', () => {
  return {
    ApiError: class ApiError extends Error {
      status = 0
    },
  }
})

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: vi.fn() } }
})

const RECORD_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const OUTPUT_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3302'

function failedRecord(): ImageRecord {
  const createdAt = '2026-01-01T00:00:00.000Z'

  return {
    id: RECORD_ID,
    createdAt,
    updatedAt: createdAt,
    status: 'failed',
    provider: 'openrouter',
    preset: { id: 'gpt-image-2.5-sunburst', title: 'GPT Image 2.5 Sunburst', slug: 'sunburst' },
    input: {
      presetId: 'gpt-image-2.5-sunburst',
      prompt: 'a cat',
      count: 1,
      aspectRatio: '1:1',
      resolution: null,
      quality: 'high',
      background: 'auto',
      references: [],
      seed: 123,
    },
    outputs: [{ id: OUTPUT_ID, index: 0, status: 'failed', error: 'No' }],
    seedUsed: 123,
    cost: {
      currency: 'USD',
      unit: 'token',
      estimatedUsd: 0.2,
      actualUsd: null,
      priceSource: 'mock',
      billed: null,
    },
  }
}

function panel() {
  return <DetailsPanel item={required(imageItems(failedRecord())[0], 'image item')} />
}

beforeEach(() => {
  createImage.mockReset()
  deleteImageOutput.mockReset()
  createImage.mockResolvedValue(undefined)
  deleteImageOutput.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('details image actions', () => {
  it('confirms a regenerate and submits once', async () => {
    render(panel())

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }))

    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByText('Regenerate 1 image for ~$0.12?')).not.toBeNull()
    expect(createImage).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Regenerate' }))

    await waitFor(() => {
      expect(createImage).toHaveBeenCalledTimes(1)
    })
  })

  it('confirms a delete before removing the output', async () => {
    render(panel())

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    const dialog = await screen.findByRole('dialog')

    expect(deleteImageOutput).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(deleteImageOutput).toHaveBeenCalledTimes(1)
    })
  })
})
