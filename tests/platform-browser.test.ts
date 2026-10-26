// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '@/core/schemas/generation-record'

vi.mock('@/lib/api/system', () => {
  return {
    chooseFiles: vi.fn(),
    chooseFolder: vi.fn(),
    fetchSystemCapabilities: vi.fn(),
  }
})

const record = (id: string): GenerationRecord => {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'completed',
    provider: 'openrouter',
    input: {
      presetId: 'seedance-2.0',
      tab: 'references',
      prompt: 'A cat',
      audio: true,
      duration: 4,
      aspectRatio: '16:9',
      resolution: '1080p',
      frames: { start: null, end: null },
      references: [],
      seed: null,
    },
    preset: { id: 'seedance-2.0', title: 'Seedance', slug: 'seedance' },
    inputsSnapshot: {},
    seedUsed: 1,
    favorite: false,
    cost: {
      currency: 'USD',
      pricePerSec: 0,
      priceSource: 'mock',
      estimatedUsd: 0,
      actualUsd: 0,
      isByok: false,
      billed: true,
    },
    output: { video: `${id}.mp4` },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('browser saveVideo', () => {
  it('starts one download and reports it saved', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { browserPlatform } = await import('@/lib/platform/browser')

    await expect(browserPlatform.saveVideo(record('a'))).resolves.toBe(true)
    expect(click).toHaveBeenCalledTimes(1)
  })
})
