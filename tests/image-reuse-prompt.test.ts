// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reuseImagePrompt } from '@/features/history/actions/image-actions'
import { useImageGeneratorStore } from '@/features/image-generator/store'

import { imageItemsOf } from './helpers/image-history'
import { required } from './helpers/required'
import { upload } from './helpers/validation-fixtures'

const mocks = vi.hoisted(() => {
  return {
    fetchUploadsByIds: vi.fn(),
    setWorkspaceTab: vi.fn(),
  }
})

vi.mock('@/lib/api/generations', () => {
  return { fetchUploadsByIds: mocks.fetchUploadsByIds }
})

vi.mock('@/features/shared/use-workspace-tab', () => {
  return { setWorkspaceTab: mocks.setWorkspaceTab }
})

vi.mock('@/features/generator/media-actions', () => {
  return { applyImageOutputReference: vi.fn() }
})

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: vi.fn() } }
})

beforeEach(() => {
  mocks.fetchUploadsByIds.mockReset()
  mocks.setWorkspaceTab.mockReset()

  useImageGeneratorStore.setState({
    presetId: 'gemini-3.1-flash-image',
    prompt: '',
    references: ['stale-reference'],
    uploadsById: {},
    seed: null,
  })
})

describe('reuseImagePrompt', () => {
  it('loads the references and the seed into the draft', async () => {
    const first = upload('reuse-ref-1', 'image')
    const second = upload('reuse-ref-2', 'image')

    mocks.fetchUploadsByIds.mockResolvedValue([first, second])

    const base = required(imageItemsOf(['reuse-output'])[0], 'image item')

    const source = {
      ...base.source,
      input: {
        ...base.source.input,
        references: [first.id, second.id],
        seed: 42,
      },
      seedUsed: 42,
      seedLocked: true,
    }

    await reuseImagePrompt({ ...base, source })

    const state = useImageGeneratorStore.getState()

    expect(state.references).toEqual([first.id, second.id])
    expect(state.references).not.toContain('stale-reference')
    expect(state.seed).toBe(42)
    expect(state.prompt).toBe('a cat')
    expect(mocks.setWorkspaceTab).toHaveBeenCalledWith('image')
  })
})
