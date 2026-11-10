// @vitest-environment jsdom

/* eslint-disable max-lines-per-function -- draft cases share one storage key and rehydrate helper */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const DRAFT_KEY = 'unplatform-ai:image-draft'

const waitForRehydrate = () => {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

beforeEach(() => {
  window.localStorage.clear()
  vi.resetModules()
})

describe('image draft persistence', () => {
  it('restores the image draft after a reload', async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        state: {
          presetId: 'seedream-5-0-flash',
          prompt: 'a fox',
          count: 2,
          aspectRatio: '16:9',
          resolution: '2K',
          quality: null,
          background: null,
          references: ['first', 'second'],
          seed: 42,
        },
        version: 1,
      }),
    )

    const { useImageGeneratorStore } = await import('@/features/image-generator/store')

    await waitForRehydrate()

    const state = useImageGeneratorStore.getState()

    expect(state.prompt).toBe('a fox')
    expect(state.count).toBe(2)
    expect(state.aspectRatio).toBe('16:9')
    expect(state.resolution).toBe('2K')
    expect(state.references).toEqual(['first', 'second'])
    expect(state.seed).toBe(42)
  })

  it('applies the stored preset cap and clears its unsupported seed', async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        state: {
          presetId: 'gemini-2.5-flash-image',
          prompt: 'a fox',
          count: 1,
          aspectRatio: '1:1',
          resolution: '1K',
          quality: null,
          background: null,
          references: ['one', 'two', 'three', 'four'],
          seed: 42,
        },
        version: 1,
      }),
    )

    const { useImageGeneratorStore } = await import('@/features/image-generator/store')

    await waitForRehydrate()

    const state = useImageGeneratorStore.getState()

    expect(state.references).toEqual(['one', 'two', 'three'])
    expect(state.seed).toBeNull()
  })

  it('falls back to the defaults when the stored draft is invalid', async () => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ state: { count: 'two' }, version: 1 }))

    const { useImageGeneratorStore } = await import('@/features/image-generator/store')

    await waitForRehydrate()

    const state = useImageGeneratorStore.getState()

    expect(state.prompt).toBe('')
    expect(state.count).toBe(1)
    expect(state.references).toEqual([])
  })

  it('keeps a custom preset before its catalog entry loads', async () => {
    const presetId = 'custom.ep1.sdxl'

    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        state: {
          presetId,
          prompt: 'a fox',
          count: 1,
          aspectRatio: '1:1',
          resolution: null,
          quality: null,
          background: null,
          references: [],
          seed: null,
        },
        version: 1,
      }),
    )

    const { useImageGeneratorStore } = await import('@/features/image-generator/store')

    await waitForRehydrate()

    const state = useImageGeneratorStore.getState()

    expect(state.presetId).toBe(presetId)
    expect(state.prompt).toBe('a fox')
  })
})
