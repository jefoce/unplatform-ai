// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { isNil } from 'lodash-es'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getPreset, setRuntimeVideoPresets } from '@/core/presets'
import { imageResolutionOptions } from '@/core/presets/common/options'
import { findImagePreset, setRuntimeImagePresets } from '@/core/presets/image'
import type { ImagePreset } from '@/core/presets/image/types'
import type { VideoPreset } from '@/core/presets/video/types'
import { snapshotTitle } from '@/core/record-source'
import { useGenerate } from '@/features/generator/generate/use-generate'
import { useGeneratorStore } from '@/features/generator/store/store'
import { useImageGeneratorStore } from '@/features/image-generator/store'
import { useImageSubmit } from '@/features/image-generator/use-image-submit'
import { freshPresetReason } from '@/lib/api/endpoints-status'
import { createGeneration } from '@/lib/api/generations'
import { createImage } from '@/lib/api/images'

import { upload, uploadsOf } from './helpers/normalize-fixtures'
import { required } from './helpers/required'
import { imageRecord } from './helpers/status-labels'
import { storedRecord } from './helpers/stored-record'

const mocks = vi.hoisted(() => {
  return { toast: vi.fn() }
})

vi.mock('sonner', () => {
  return {
    toast: Object.assign(mocks.toast, { success: vi.fn(), error: vi.fn() }),
  }
})

vi.mock('@/lib/api/endpoints-status', () => {
  return { freshPresetReason: vi.fn() }
})

vi.mock('@/lib/api/generations', () => {
  return { createGeneration: vi.fn() }
})

vi.mock('@/lib/api/images', () => {
  return { createImage: vi.fn() }
})

vi.mock('@/lib/api/credits', () => {
  return { refreshCredits: vi.fn() }
})

vi.mock('@/lib/history-feed-refresh', () => {
  return { refreshHistoryFeeds: vi.fn() }
})

vi.mock('@/lib/image-feed-refresh', () => {
  return { refreshImages: vi.fn() }
})

vi.mock('@/features/shared/request-notifications', () => {
  return { requestNotifications: vi.fn() }
})

const mockFresh = vi.mocked(freshPresetReason)
const mockCreateGeneration = vi.mocked(createGeneration)
const mockCreateImage = vi.mocked(createImage)

const VIDEO_BASE = getPreset('wan-3.0')

const CHANGED_VIDEO: VideoPreset = {
  ...VIDEO_BASE,
  id: 'custom.cu1.wan22',
  title: 'Wan 2.2 I2V',
  family: 'custom',
  description: 'Updated local workflow',
  resolutions: ['480p'],
  defaultResolution: '480p',
  aspectRatios: ['16:9'],
  defaultAspectRatio: '16:9',
  references: { image: 1, video: 0, audio: 0, videoTotalSec: 0, audioTotalSec: 0 },
  autoAspectWithFrames: false,
}

const IMAGE_BASE = findImagePreset('gemini-3.1-flash-image')

if (isNil(IMAGE_BASE)) {
  throw new Error('Missing image preset')
}

const CHANGED_IMAGE: ImagePreset = {
  ...IMAGE_BASE,
  id: 'custom.cu1.sdxl',
  title: 'SDXL',
  family: 'custom',
  resolutions: imageResolutionOptions(['1K']),
  defaultResolution: '1K',
  aspectRatios: ['1:1'],
  defaultAspectRatio: '1:1',
  referenceMax: 1,
}

function seedVideoDraft(): void {
  useGeneratorStore.setState({
    presetId: CHANGED_VIDEO.id,
    tab: 'references',
    prompts: { frames: '', references: 'a cat' },
    audio: false,
    duration: CHANGED_VIDEO.duration.default,
    aspectRatio: '9:16',
    resolution: '720p',
    frames: { start: null, end: null },
    references: ['i1', 'i2', 'i3'],
    seed: null,
    uploadsById: uploadsOf(upload('i1', 'image'), upload('i2', 'image'), upload('i3', 'image')),
  })
}

function seedImageDraft(): void {
  useImageGeneratorStore.setState({
    presetId: CHANGED_IMAGE.id,
    prompt: 'a cat',
    count: 1,
    aspectRatio: '21:9',
    resolution: '4K',
    quality: null,
    background: null,
    references: ['r1', 'r2', 'r3'],
    seed: null,
    uploadsById: {},
  })
}

function noticeText(): string {
  const notice = mocks.toast.mock.calls.find(([text]) => {
    return String(text).includes('Removed')
  })

  return String(required(notice?.[0], 'changed notice'))
}

beforeEach(() => {
  mockFresh.mockReset()
  mockCreateGeneration.mockReset()
  mockCreateImage.mockReset()
  mocks.toast.mockReset()

  setRuntimeVideoPresets([])
  setRuntimeImagePresets([])

  mockFresh.mockResolvedValue(null)
  mockCreateImage.mockResolvedValue(imageRecord())

  mockCreateGeneration.mockResolvedValue(
    storedRecord('record-1', {
      status: 'pending',
      provider: 'custom',
      preset: { id: CHANGED_VIDEO.id, title: CHANGED_VIDEO.title, slug: 'wan22' },
    }),
  )
})

afterEach(() => {
  cleanup()
  setRuntimeVideoPresets([])
  setRuntimeImagePresets([])
})

describe('custom video draft refresh', () => {
  it('normalizes the draft and never submits the old values', async () => {
    setRuntimeVideoPresets([CHANGED_VIDEO])
    seedVideoDraft()

    const { result } = renderHook(() => {
      return useGenerate()
    })

    await act(async () => {
      await result.current.generate()
    })

    const sent = required(mockCreateGeneration.mock.calls[0]?.[0], 'submitted video input')

    expect(sent.presetId).toBe(CHANGED_VIDEO.id)
    expect(sent.resolution).toBe('480p')
    expect(sent.aspectRatio).toBe('16:9')
    expect(sent.references).toEqual(['i1'])
    expect(sent.resolution).not.toBe('720p')
    expect(sent.aspectRatio).not.toBe('9:16')

    expect(noticeText()).toContain('Removed 2 image references')
    expect(noticeText()).toContain('Resolution set to 480p')
    expect(noticeText()).toContain('Aspect set to 16:9')

    expect(required(mocks.toast.mock.invocationCallOrder[0], 'notice order')).toBeLessThan(
      required(mockCreateGeneration.mock.invocationCallOrder[0], 'submit order'),
    )

    expect(useGeneratorStore.getState()).toMatchObject({
      resolution: '480p',
      aspectRatio: '16:9',
      references: ['i1'],
    })
  })
})

describe('custom image draft refresh', () => {
  it('normalizes the draft and flags the extra references before submit', async () => {
    setRuntimeImagePresets([CHANGED_IMAGE])
    seedImageDraft()

    const { result } = renderHook(() => {
      return useImageSubmit({ canSubmit: true })
    })

    await act(async () => {
      await result.current.submit()
    })

    const sent = required(mockCreateImage.mock.calls[0]?.[0], 'submitted image input')

    expect(sent.presetId).toBe(CHANGED_IMAGE.id)
    expect(sent.resolution).toBe('1K')
    expect(sent.aspectRatio).toBe('1:1')
    expect(sent.references).toEqual(['r1'])
    expect(sent.resolution).not.toBe('4K')
    expect(sent.aspectRatio).not.toBe('21:9')

    expect(noticeText()).toContain('Removed 2 image references')
    expect(noticeText()).toContain('Resolution set to 1K')
    expect(noticeText()).toContain('Aspect set to 1:1')

    expect(required(mocks.toast.mock.invocationCallOrder[0], 'notice order')).toBeLessThan(
      required(mockCreateImage.mock.invocationCallOrder[0], 'submit order'),
    )

    expect(useImageGeneratorStore.getState()).toMatchObject({
      resolution: '1K',
      aspectRatio: '1:1',
      references: ['r1'],
    })
  })
})

describe('renamed workflow history', () => {
  it('keeps the snapshot title after the workflow is renamed', () => {
    const title = snapshotTitle({
      preset: { title: 'New Wan Workflow' },
      presetSnapshot: { title: 'Old Wan Workflow' },
    })

    expect(title).toBe('Old Wan Workflow')
  })
})
