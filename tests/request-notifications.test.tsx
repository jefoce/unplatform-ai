// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGenerate } from '@/features/generator/generate/use-generate'
import { useGeneratorStore } from '@/features/generator/store/store'
import { useImageGeneratorStore } from '@/features/image-generator/store'
import { useImageSubmit } from '@/features/image-generator/use-image-submit'

import { record } from './helpers/history'

const mocks = vi.hoisted(() => {
  return {
    createGeneration: vi.fn(),
    createImage: vi.fn(),
    requestNotifications: vi.fn(),
    refreshHistoryFeeds: vi.fn(async () => {}),
    refreshCredits: vi.fn(async () => {}),
    refreshImages: vi.fn(async () => {}),
  }
})

vi.mock('@/lib/platform', () => {
  return {
    getPlatform: async () => {
      return { requestNotifications: mocks.requestNotifications }
    },
  }
})

vi.mock('@/lib/api/generations', () => {
  return { createGeneration: mocks.createGeneration }
})

vi.mock('@/lib/api/images', () => {
  return { createImage: mocks.createImage }
})

vi.mock('@/lib/history-feed-refresh', () => {
  return { refreshHistoryFeeds: mocks.refreshHistoryFeeds }
})

vi.mock('@/lib/api/credits', () => {
  return { refreshCredits: mocks.refreshCredits }
})

vi.mock('@/lib/image-feed-refresh', () => {
  return { refreshImages: mocks.refreshImages }
})

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: vi.fn() } }
})

beforeEach(() => {
  mocks.createGeneration.mockReset()
  mocks.createImage.mockReset()
  mocks.requestNotifications.mockReset()
  mocks.createGeneration.mockResolvedValue(record('generated'))
  mocks.createImage.mockResolvedValue({})
  useGeneratorStore.getState().reset()
  useGeneratorStore.setState({ prompts: { frames: 'a cat', references: '' } })
  useImageGeneratorStore.setState({ prompt: 'a cat' })
})

afterEach(() => {
  cleanup()
})

describe('notification permission', () => {
  it('asks once from the video submit path', async () => {
    const { result } = renderHook(() => {
      return useGenerate({ canSubmit: true })
    })

    await act(async () => {
      await result.current.generate()
    })

    expect(mocks.requestNotifications).toHaveBeenCalledTimes(1)
  })

  it('asks once from the image submit path', async () => {
    const { result } = renderHook(() => {
      return useImageSubmit({ canSubmit: true })
    })

    await act(async () => {
      await result.current.submit()
    })

    await waitFor(() => {
      expect(mocks.requestNotifications).toHaveBeenCalledTimes(1)
    })
  })
})
