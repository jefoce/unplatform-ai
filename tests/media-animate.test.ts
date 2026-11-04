// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyImageOutputFrame,
  applyImageOutputReference,
} from '@/features/generator/media-actions'
import { useGeneratorStore } from '@/features/generator/store/store'
import { useImageGeneratorStore } from '@/features/image-generator/store'

import type { UploadItem } from '../src/core/schemas/upload-item'
import { upload } from './helpers/validation-fixtures'

const mocks = vi.hoisted(() => {
  return {
    createImageOutputUpload: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }
})

vi.mock('@/lib/api/images', () => {
  return { createImageOutputUpload: mocks.createImageOutputUpload }
})

vi.mock('sonner', () => {
  return {
    toast: { success: mocks.success, error: mocks.error },
  }
})

const IMAGE: UploadItem = upload('frame', 'image')

beforeEach(() => {
  mocks.createImageOutputUpload.mockReset()
  mocks.success.mockReset()
  mocks.error.mockReset()
  window.history.replaceState(null, '', '/')

  useGeneratorStore.setState({
    presetId: 'wan-3.0',
    tab: 'references',
    references: [],
    uploadsById: {},
    frames: { start: null, end: null },
  })

  useImageGeneratorStore.setState({
    presetId: 'gemini-3.1-flash-image',
    references: [],
    uploadsById: {},
  })
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('applyImageOutputFrame', () => {
  it('puts the output in the requested end slot', async () => {
    mocks.createImageOutputUpload.mockResolvedValue(IMAGE)

    const isApplied = await applyImageOutputFrame({
      recordId: 'record',
      outputId: 'output',
      slot: 'end',
    })

    expect(isApplied).toBe(true)
    expect(useGeneratorStore.getState().frames.end).toBe(IMAGE.id)
    expect(mocks.success).toHaveBeenCalledWith('End frame set')
  })
})

describe('applyImageOutputReference', () => {
  it('copies the output into the video draft in the video workspace', async () => {
    mocks.createImageOutputUpload.mockResolvedValue(IMAGE)

    const isAdded = await applyImageOutputReference({ recordId: 'record', outputId: 'output' })

    expect(isAdded).toBe(true)
    expect(useGeneratorStore.getState().references).toEqual([IMAGE.id])
    expect(useImageGeneratorStore.getState().references).toEqual([])
    expect(mocks.success).toHaveBeenCalledWith('Added as reference')
  })

  it('copies the output into the image draft in the image workspace', async () => {
    window.history.replaceState(null, '', '/?tab=image')
    mocks.createImageOutputUpload.mockResolvedValue(IMAGE)

    const isAdded = await applyImageOutputReference({ recordId: 'record', outputId: 'output' })

    expect(isAdded).toBe(true)
    expect(useImageGeneratorStore.getState().references).toEqual([IMAGE.id])
    expect(useGeneratorStore.getState().references).toEqual([])
    expect(mocks.success).toHaveBeenCalledWith('Added as reference')
  })

  it('reports an error when the image draft refuses the reference', async () => {
    window.history.replaceState(null, '', '/?tab=image')
    mocks.createImageOutputUpload.mockResolvedValue(IMAGE)

    useImageGeneratorStore.setState({
      presetId: 'gemini-2.5-flash-image',
      references: ['image-1', 'image-2', 'image-3'],
    })

    const isAdded = await applyImageOutputReference({ recordId: 'record', outputId: 'output' })

    expect(isAdded).toBe(false)
    expect(mocks.error).toHaveBeenCalledWith('Reference limit reached')
  })

  it('reports an error when the video draft refuses the reference', async () => {
    mocks.createImageOutputUpload.mockResolvedValue(IMAGE)
    useGeneratorStore.setState({ references: [IMAGE.id] })

    const isAdded = await applyImageOutputReference({ recordId: 'record', outputId: 'output' })

    expect(isAdded).toBe(false)
    expect(mocks.error).toHaveBeenCalledWith('Already attached')
  })
})
