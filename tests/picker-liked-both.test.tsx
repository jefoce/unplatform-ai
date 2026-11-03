// @vitest-environment jsdom
import { type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenerationListResult } from '@/core/api/video'
import { LikedGenerations } from '@/features/media-picker/picker/LikedGenerations'
import type * as GenerationsModule from '@/lib/api/generations'
import type * as ImagesModule from '@/lib/api/images'

import type { ImageListResult } from '../src/core/api/image'
import type { GenerationRecord } from '../src/core/schemas/generation-record'
import type { ImageRecord } from '../src/core/schemas/image-record'

const mocks = vi.hoisted(() => {
  return { fetchImagePage: vi.fn(), fetchGenerationPage: vi.fn() }
})

vi.mock('@/lib/api/images', async (importOriginal) => {
  const actual = await importOriginal<typeof ImagesModule>()

  return { ...actual, fetchImagePage: mocks.fetchImagePage }
})

vi.mock('@/lib/api/generations', async (importOriginal) => {
  const actual = await importOriginal<typeof GenerationsModule>()

  return { ...actual, fetchGenerationPage: mocks.fetchGenerationPage }
})

function imageRecord(): ImageRecord {
  const createdAt = '2026-01-02T00:00:00.000Z'

  return {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    createdAt,
    updatedAt: createdAt,
    status: 'completed',
    provider: 'openrouter',
    preset: { id: 'fixture-image', title: 'Image fixture', slug: 'fixture-image' },
    input: {
      presetId: 'fixture-image',
      prompt: 'a cat',
      count: 1,
      aspectRatio: '1:1',
      resolution: '1K',
      quality: null,
      background: null,
      references: [],
      seed: null,
    },
    outputs: [
      {
        id: '3f2504e0-4f89-41d3-9a0c-0305e82c3302',
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
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd: 0,
      actualUsd: null,
      priceSource: 'mock',
      billed: null,
    },
  }
}

function videoRecord(): GenerationRecord {
  const createdAt = '2026-01-01T00:00:00.000Z'

  return {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3303',
    createdAt,
    updatedAt: createdAt,
    status: 'completed',
    provider: 'openrouter',
    preset: { id: 'fixture-video', title: 'Video fixture', slug: 'fixture-video' },
    input: {
      presetId: 'fixture-video',
      tab: 'references',
      prompt: 'a dog',
      audio: false,
      duration: 4,
      aspectRatio: '16:9',
      resolution: '720p',
      frames: { start: null, end: null },
      references: [],
      seed: null,
    },
    inputsSnapshot: {},
    seedUsed: null,
    favorite: true,
    cost: {
      currency: 'USD',
      pricePerSec: 0,
      priceSource: 'mock',
      estimatedUsd: 0,
      actualUsd: 0,
      isByok: false,
      billed: true,
    },
    output: { video: 'video.mp4', preview: 'video.png' },
  }
}

function SwrWrapper(props: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        provider: () => {
          return new Map()
        },
      }}
    >
      {props.children}
    </SWRConfig>
  )
}

beforeEach(() => {
  const images: ImageListResult = { items: [imageRecord()], nextCursor: null, activeCount: 0 }
  const videos: GenerationListResult = { items: [videoRecord()], nextCursor: null, activeCount: 0 }

  mocks.fetchImagePage.mockReset()
  mocks.fetchGenerationPage.mockReset()
  mocks.fetchImagePage.mockResolvedValue(images)
  mocks.fetchGenerationPage.mockResolvedValue(videos)
})

describe('LikedGenerations', () => {
  it('shows liked image outputs and videos in both mode', async () => {
    render(
      <SwrWrapper>
        <LikedGenerations modeKind="toggle" />
      </SwrWrapper>,
    )

    expect(
      await screen.findByRole('button', { name: 'Use Image fixture generation' }),
    ).not.toBeNull()

    expect(screen.getByRole('button', { name: 'Use Video fixture generation' })).not.toBeNull()
  })
})
