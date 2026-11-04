/* eslint-disable max-lines, max-lines-per-function -- clear and submit cases share one store setup */

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGenerate } from '@/features/generator/generate/use-generate'
import { ClearDraftButton } from '@/features/generator/prompt/ClearDraftButton'
import { useClearVideoDraft } from '@/features/generator/prompt/use-clear-video-draft'
import { useGeneratorStore } from '@/features/generator/store/store'
import { useImageGeneratorStore } from '@/features/image-generator/store'
import { useClearImageDraft } from '@/features/image-generator/use-clear-image-draft'

import { record } from './helpers/history'
import { upload, uploadsOf } from './helpers/normalize-fixtures'

vi.hoisted(() => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: () => {
        return { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
      },
    })
  }
})

const mocks = vi.hoisted(() => {
  return {
    createGeneration: vi.fn(),
    refreshHistoryFeeds: vi.fn(async () => {}),
    refreshCredits: vi.fn(async () => {}),
    requestNotifications: vi.fn(),
    toast: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
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

vi.mock('@/lib/history-feed-refresh', () => {
  return { refreshHistoryFeeds: mocks.refreshHistoryFeeds }
})

vi.mock('@/lib/api/credits', () => {
  return { refreshCredits: mocks.refreshCredits }
})

vi.mock('sonner', () => {
  return {
    toast: Object.assign(mocks.toast, {
      success: mocks.toastSuccess,
      error: mocks.toastError,
    }),
  }
})

interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastOptions {
  duration: number
  action: ToastAction
}

const noopUndo = (): void => {}

beforeEach(() => {
  mocks.createGeneration.mockReset()
  mocks.createGeneration.mockResolvedValue(record('generated'))
  mocks.toast.mockReset()
  useGeneratorStore.getState().reset()
  useImageGeneratorStore.setState({ prompt: '', references: [], uploadsById: {} })
})

afterEach(() => {
  cleanup()
})

describe('video draft clearing', () => {
  it('clears the frames prompt and slots, keeps the settings, and undoes', () => {
    useGeneratorStore.setState({
      tab: 'frames',
      prompts: { frames: 'frames prompt', references: 'references prompt' },
      frames: { start: 'start-1', end: 'end-1' },
      references: ['keep-ref'],
      uploadsById: uploadsOf(upload('start-1', 'image'), upload('end-1', 'image')),
      audio: false,
      duration: 6,
      aspectRatio: '4:3',
      resolution: '720p',
      seed: 11,
    })

    const { result } = renderHook(() => {
      return useClearVideoDraft()
    })

    let undo = noopUndo

    expect(result.current.isDisabled).toBe(false)

    act(() => {
      undo = result.current.clear()
    })

    const cleared = useGeneratorStore.getState()

    expect(cleared.prompts.frames).toBe('')
    expect(cleared.prompts.references).toBe('references prompt')
    expect(cleared.frames).toEqual({ start: null, end: null })
    expect(cleared.references).toEqual(['keep-ref'])
    expect(cleared.audio).toBe(false)
    expect(cleared.duration).toBe(6)
    expect(cleared.aspectRatio).toBe('4:3')
    expect(cleared.resolution).toBe('720p')
    expect(cleared.seed).toBe(11)

    act(() => {
      undo()
    })

    const restored = useGeneratorStore.getState()

    expect(restored.prompts.frames).toBe('frames prompt')
    expect(restored.frames).toEqual({ start: 'start-1', end: 'end-1' })
    expect(restored.uploadsById['start-1']).toBeDefined()
    expect(restored.uploadsById['end-1']).toBeDefined()
  })

  it('clears the references prompt and ids, keeps the settings, and undoes', () => {
    useGeneratorStore.setState({
      tab: 'references',
      prompts: { frames: 'frames prompt', references: 'references prompt' },
      frames: { start: 'start-1', end: 'end-1' },
      references: ['ref-1'],
      uploadsById: uploadsOf(upload('ref-1', 'image')),
      audio: true,
      duration: 8,
      aspectRatio: '16:9',
      resolution: '1080p',
      seed: 22,
    })

    const { result } = renderHook(() => {
      return useClearVideoDraft()
    })

    let undo = noopUndo

    act(() => {
      undo = result.current.clear()
    })

    const cleared = useGeneratorStore.getState()

    expect(cleared.prompts.references).toBe('')
    expect(cleared.prompts.frames).toBe('frames prompt')
    expect(cleared.references).toEqual([])
    expect(cleared.frames).toEqual({ start: 'start-1', end: 'end-1' })
    expect(cleared.audio).toBe(true)
    expect(cleared.duration).toBe(8)
    expect(cleared.aspectRatio).toBe('16:9')
    expect(cleared.resolution).toBe('1080p')
    expect(cleared.seed).toBe(22)

    act(() => {
      undo()
    })

    const restored = useGeneratorStore.getState()

    expect(restored.prompts.references).toBe('references prompt')
    expect(restored.references).toEqual(['ref-1'])
    expect(restored.uploadsById['ref-1']).toBeDefined()
  })

  it('is disabled when the active tab has nothing to clear', () => {
    const { result } = renderHook(() => {
      return useClearVideoDraft()
    })

    expect(result.current.isDisabled).toBe(true)

    act(() => {
      useGeneratorStore.setState({ tab: 'references' })
    })

    expect(result.current.isDisabled).toBe(true)

    act(() => {
      useGeneratorStore.setState({ references: ['ref-1'] })
    })

    expect(result.current.isDisabled).toBe(false)
  })

  it('keeps the prompt and inputs after a submit in both tabs', async () => {
    useGeneratorStore.setState({
      tab: 'frames',
      prompts: { frames: 'frames prompt', references: 'references prompt' },
      frames: { start: 'start-1', end: 'end-1' },
      references: ['ref-1'],
    })

    const { result } = renderHook(() => {
      return useGenerate({ canSubmit: true })
    })

    await act(async () => {
      await result.current.generate()
    })

    const framesState = useGeneratorStore.getState()

    expect(framesState.prompts.frames).toBe('frames prompt')
    expect(framesState.frames).toEqual({ start: 'start-1', end: 'end-1' })
    expect(framesState.references).toEqual(['ref-1'])

    act(() => {
      useGeneratorStore.setState({ tab: 'references' })
    })

    await act(async () => {
      await result.current.generate()
    })

    const referencesState = useGeneratorStore.getState()

    expect(referencesState.prompts.references).toBe('references prompt')
    expect(referencesState.references).toEqual(['ref-1'])
  })
})

describe('image draft clearing', () => {
  it('clears the prompt and references, keeps the settings, and undoes', () => {
    useImageGeneratorStore.setState({
      prompt: 'a cat',
      references: ['ref-1'],
      uploadsById: uploadsOf(upload('ref-1', 'image')),
      count: 3,
      aspectRatio: '3:2',
      resolution: '2K',
      quality: 'high',
      background: 'opaque',
      seed: 9,
    })

    const presetId = useImageGeneratorStore.getState().presetId

    const { result } = renderHook(() => {
      return useClearImageDraft()
    })

    let undo = noopUndo

    expect(result.current.isDisabled).toBe(false)

    act(() => {
      undo = result.current.clear()
    })

    const cleared = useImageGeneratorStore.getState()

    expect(cleared.prompt).toBe('')
    expect(cleared.references).toEqual([])
    expect(cleared.presetId).toBe(presetId)
    expect(cleared.count).toBe(3)
    expect(cleared.aspectRatio).toBe('3:2')
    expect(cleared.resolution).toBe('2K')
    expect(cleared.quality).toBe('high')
    expect(cleared.background).toBe('opaque')
    expect(cleared.seed).toBe(9)

    act(() => {
      undo()
    })

    const restored = useImageGeneratorStore.getState()

    expect(restored.prompt).toBe('a cat')
    expect(restored.references).toEqual(['ref-1'])
    expect(restored.uploadsById['ref-1']).toBeDefined()
  })

  it('is disabled when there is nothing to clear', () => {
    const { result } = renderHook(() => {
      return useClearImageDraft()
    })

    expect(result.current.isDisabled).toBe(true)

    act(() => {
      useImageGeneratorStore.setState({ prompt: 'a cat' })
    })

    expect(result.current.isDisabled).toBe(false)
  })
})

describe('ClearDraftButton', () => {
  it('shows one five second Undo toast', () => {
    const undo = vi.fn()

    const onClear = vi.fn(() => {
      return undo
    })

    render(<ClearDraftButton isDisabled={false} onClear={onClear} />)

    fireEvent.click(screen.getByRole('button', { name: 'Clear prompt and inputs' }))

    expect(mocks.toast).toHaveBeenCalledWith('Cleared', expect.objectContaining({ duration: 5000 }))

    const options = mocks.toast.mock.calls[0]?.[1] as ToastOptions | undefined

    expect(options?.action.label).toBe('Undo')

    act(() => {
      options?.action.onClick()
    })

    expect(undo).toHaveBeenCalledTimes(1)
  })

  it('is disabled when there is nothing to clear', () => {
    const onClear = vi.fn()

    render(<ClearDraftButton isDisabled onClear={onClear} />)

    const button = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Clear prompt and inputs',
    })

    expect(button.disabled).toBe(true)

    fireEvent.click(button)

    expect(onClear).not.toHaveBeenCalled()
  })
})
