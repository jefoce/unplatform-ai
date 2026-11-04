// @vitest-environment jsdom
import { act, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { openReferencePicker } from '@/features/image-generator/image-picker'
import { useImageGeneratorStore } from '@/features/image-generator/store'
import {
  outputKey,
  type PickerOutputCandidate,
  useMediaPickerStore,
} from '@/features/media-picker/picker/store'

import type { UploadItem } from '../src/core/schemas/upload-item'
import { required } from './helpers/required'

const createImageOutputUpload = vi.hoisted(() => {
  return vi.fn()
})

vi.mock('@/lib/api/images', () => {
  return { createImageOutputUpload }
})

vi.mock('@/lib/notify', () => {
  return { toastError: vi.fn() }
})

const RECORD_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const OUTPUT_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3302'
const UPLOAD_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3303'

const UPLOAD: UploadItem = {
  id: UPLOAD_ID,
  source: 'file',
  kind: 'image',
  mime: 'image/png',
  ext: 'png',
  originalName: 'image-0.png',
  sizeBytes: 2048,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const CANDIDATE: PickerOutputCandidate = {
  recordId: RECORD_ID,
  outputId: OUTPUT_ID,
  recordKind: 'image',
  favorite: false,
}

beforeEach(() => {
  useMediaPickerStore.setState({ request: null, outputUploads: {} })
  useImageGeneratorStore.setState({ references: [], uploadsById: {} })
  createImageOutputUpload.mockReset()
  createImageOutputUpload.mockResolvedValue(UPLOAD)
})

describe('picker generation selection', () => {
  it('removes the same output when toggled twice', async () => {
    openReferencePicker()

    const output = required(useMediaPickerStore.getState().request?.output, 'output mode')

    output.onToggle?.(CANDIDATE)

    await waitFor(() => {
      expect(useImageGeneratorStore.getState().references).toEqual([UPLOAD_ID])
    })

    expect(useMediaPickerStore.getState().outputUploads[outputKey(CANDIDATE)]).toBe(UPLOAD_ID)

    output.onToggle?.(CANDIDATE)

    expect(useImageGeneratorStore.getState().references).toEqual([])
    expect(useMediaPickerStore.getState().outputUploads[outputKey(CANDIDATE)]).toBeUndefined()
    expect(createImageOutputUpload).toHaveBeenCalledTimes(1)
  })

  it('creates one upload when toggled twice before the first resolves', async () => {
    let resolveUpload: ((upload: UploadItem) => void) | undefined

    createImageOutputUpload.mockReturnValue(
      new Promise<UploadItem>((resolve) => {
        resolveUpload = resolve
      }),
    )

    openReferencePicker()

    const output = required(useMediaPickerStore.getState().request?.output, 'output mode')

    output.onToggle?.(CANDIDATE)
    output.onToggle?.(CANDIDATE)

    expect(createImageOutputUpload).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveUpload?.(UPLOAD)
    })

    await waitFor(() => {
      expect(useImageGeneratorStore.getState().references).toEqual([UPLOAD_ID])
    })

    expect(createImageOutputUpload).toHaveBeenCalledTimes(1)
  })
})
