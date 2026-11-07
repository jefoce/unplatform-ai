// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

const DRAFT_KEY = 'unplatform-ai:draft'
const CUSTOM_ID = 'custom.cu1.wan22'

const waitForRehydrate = () => {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

vi.mock('sonner', () => {
  return { toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }
})

beforeEach(() => {
  window.localStorage.clear()
  vi.resetModules()
})

describe('custom draft hydration', () => {
  it('keeps a persisted custom preset before its catalog entry loads', async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        state: {
          presetId: CUSTOM_ID,
          tab: 'frames',
          prompts: { frames: '', references: '' },
          audio: true,
          duration: 5,
          aspectRatio: '16:9',
          resolution: '1080p',
          frames: { start: null, end: null },
          references: [],
          seed: null,
        },
        version: 3,
      }),
    )

    const { useGeneratorStore } = await import('@/features/generator/store/store')

    await waitForRehydrate()

    expect(useGeneratorStore.getState().presetId).toBe(CUSTOM_ID)
  })

  it('keeps a custom preset when a loaded draft is normalized', async () => {
    const { useGeneratorStore } = await import('@/features/generator/store/store')

    useGeneratorStore.setState({ presetId: CUSTOM_ID })

    useGeneratorStore.getState().normalizeLoaded()

    expect(useGeneratorStore.getState().presetId).toBe(CUSTOM_ID)
  })

  it('keeps a custom preset when an input is loaded', async () => {
    const { useGeneratorStore } = await import('@/features/generator/store/store')
    const { input } = await import('./helpers/validation-fixtures')

    useGeneratorStore.getState().loadInput(input({ presetId: CUSTOM_ID, duration: 7 }), [])

    expect(useGeneratorStore.getState().presetId).toBe(CUSTOM_ID)
    expect(useGeneratorStore.getState().duration).toBe(7)
  })
})
