// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ZOOM_DEFAULT } from '@/core/constants'
import { DEFAULT_PRESET_ID, getPreset } from '@/core/presets'

const VIEW_KEY = 'unplatform-ai:view'
const DRAFT_KEY = 'unplatform-ai:draft'

const waitForRehydrate = () => {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

const draft = () => {
  const preset = getPreset(DEFAULT_PRESET_ID)

  return {
    presetId: preset.id,
    tab: 'frames',
    prompts: { frames: 'hello', references: '' },
    audio: preset.audio.default,
    duration: preset.duration.default,
    aspectRatio: preset.defaultAspectRatio,
    resolution: preset.defaultResolution,
    frames: { start: null, end: null },
    references: [],
    seed: 42,
  }
}

beforeEach(() => {
  window.localStorage.clear()
  vi.resetModules()
})

describe('history view persistence', () => {
  it('restores valid stored fields', async () => {
    window.localStorage.setItem(
      VIEW_KEY,
      JSON.stringify({
        state: { view: 'grid', zoom: 2, filters: { favorite: true } },
        version: 1,
      }),
    )

    const { useHistoryViewStore } = await import('@/features/history/list/view-store')
    const state = useHistoryViewStore.getState()

    expect(state.view).toBe('grid')
    expect(state.zoom).toBe(2)
    expect(state.filters.favorite).toBe(true)
  })

  it('migrates a version 0 payload without a console error', async () => {
    window.localStorage.setItem(
      VIEW_KEY,
      JSON.stringify({
        state: { view: 'grid', zoom: 2, filters: { favorite: true } },
        version: 0,
      }),
    )

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { useHistoryViewStore } = await import('@/features/history/list/view-store')
    const state = useHistoryViewStore.getState()

    expect(state.view).toBe('grid')
    expect(state.zoom).toBe(2)
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('keeps a valid view when zoom is invalid', async () => {
    window.localStorage.setItem(
      VIEW_KEY,
      JSON.stringify({
        state: { view: 'grid', zoom: '3', filters: { favorite: true } },
        version: 1,
      }),
    )

    const { useHistoryViewStore } = await import('@/features/history/list/view-store')
    const state = useHistoryViewStore.getState()

    expect(state.view).toBe('grid')
    expect(state.zoom).toBe(ZOOM_DEFAULT)
    expect(state.filters.favorite).toBe(true)
  })

  it('keeps a valid view when zoom is out of range', async () => {
    window.localStorage.setItem(
      VIEW_KEY,
      JSON.stringify({
        state: { view: 'grid', zoom: 99, filters: { favorite: true } },
        version: 1,
      }),
    )

    const { useHistoryViewStore } = await import('@/features/history/list/view-store')
    const state = useHistoryViewStore.getState()

    expect(state.view).toBe('grid')
    expect(state.zoom).toBe(ZOOM_DEFAULT)
    expect(state.filters.favorite).toBe(true)
  })

  it('restores defaults from corrupt JSON', async () => {
    window.localStorage.setItem(VIEW_KEY, '{not json')

    const { useHistoryViewStore } = await import('@/features/history/list/view-store')
    const state = useHistoryViewStore.getState()

    expect(state.view).toBe('list')
    expect(state.zoom).toBe(ZOOM_DEFAULT)
    expect(state.filters.status).toBe('all')
  })

  it('restores defaults from wrong field types', async () => {
    window.localStorage.setItem(
      VIEW_KEY,
      JSON.stringify({ state: { view: 'tiles', zoom: '3', filters: {} }, version: 1 }),
    )

    const { useHistoryViewStore } = await import('@/features/history/list/view-store')
    const state = useHistoryViewStore.getState()

    expect(state.view).toBe('list')
    expect(state.zoom).toBe(ZOOM_DEFAULT)
    expect(state.filters.favorite).toBeUndefined()
  })
})

describe('generator draft persistence', () => {
  it('restores a valid stored draft', async () => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ state: draft(), version: 3 }))

    const { useGeneratorStore } = await import('@/features/generator/store/store')

    await waitForRehydrate()

    const state = useGeneratorStore.getState()

    expect(state.prompts.frames).toBe('hello')
    expect(state.seed).toBe(42)
  })

  it('restores defaults from corrupt JSON', async () => {
    window.localStorage.setItem(DRAFT_KEY, '{not json')

    const { useGeneratorStore } = await import('@/features/generator/store/store')

    await waitForRehydrate()

    const state = useGeneratorStore.getState()

    expect(state.prompts.frames).toBe('')
    expect(state.seed).toBeNull()
  })

  it('restores defaults from wrong field types', async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ state: { ...draft(), duration: '5' }, version: 3 }),
    )

    const { useGeneratorStore } = await import('@/features/generator/store/store')

    await waitForRehydrate()

    const state = useGeneratorStore.getState()

    expect(state.prompts.frames).toBe('')
    expect(state.seed).toBeNull()
  })

  it('restores defaults from a version 2 payload with the old shape', async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        state: { presetId: DEFAULT_PRESET_ID, prompt: 'old draft', tab: 'frames' },
        version: 2,
      }),
    )

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { useGeneratorStore } = await import('@/features/generator/store/store')

    await waitForRehydrate()

    const state = useGeneratorStore.getState()

    expect(state.prompts.frames).toBe('')
    expect(state.seed).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
