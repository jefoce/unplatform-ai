// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGenerate } from '@/features/generator/generate/use-generate'
import { useGeneratorStore } from '@/features/generator/store/store'
import { freshPresetReason } from '@/lib/api/endpoints-status'
import { createGeneration } from '@/lib/api/generations'

const toastError = vi.hoisted(() => {
  return vi.fn()
})

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: toastError } }
})

vi.mock('@/lib/api/endpoints-status', () => {
  return { freshPresetReason: vi.fn() }
})

vi.mock('@/lib/api/generations', () => {
  return { createGeneration: vi.fn() }
})

vi.mock('@/lib/api/credits', () => {
  return { refreshCredits: vi.fn() }
})

vi.mock('@/lib/history-feed-refresh', () => {
  return { refreshHistoryFeeds: vi.fn() }
})

vi.mock('@/features/shared/request-notifications', () => {
  return { requestNotifications: vi.fn() }
})

const mockFresh = vi.mocked(freshPresetReason)
const mockCreate = vi.mocked(createGeneration)

beforeEach(() => {
  mockFresh.mockReset()
  mockCreate.mockReset()
  toastError.mockReset()
  useGeneratorStore.setState({ presetId: 'custom.cu1.wan22' })
})

afterEach(() => {
  cleanup()
})

describe('Generate fresh check', () => {
  it('shows the reason and creates no record when the check fails', async () => {
    mockFresh.mockResolvedValue('ComfyUI is not reachable.')

    const { result } = renderHook(() => {
      return useGenerate()
    })

    await act(async () => {
      await result.current.generate()
    })

    expect(mockCreate).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('ComfyUI is not reachable.')
  })
})
