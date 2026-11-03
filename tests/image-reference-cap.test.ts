// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  REFERENCE_ALREADY_ATTACHED,
  REFERENCE_LIMIT_REACHED,
  REFERENCE_ONLY_IMAGES,
} from '@/features/generator/reference-rules'
import { imageCanAdd, openReferencePicker } from '@/features/image-generator/image-picker'
import { useImageGeneratorStore } from '@/features/image-generator/store'
import { closeMediaPicker, useMediaPickerStore } from '@/features/media-picker/picker/store'

import { required } from './helpers/required'
import { upload, uploadsOf } from './helpers/validation-fixtures'

const toast = vi.hoisted(() => {
  return vi.fn()
})

vi.mock('sonner', () => {
  return { toast }
})

const existing = Array.from({ length: 14 }, (_, index) => {
  return upload(`image-cap-${index}`, 'image')
})

beforeEach(() => {
  toast.mockReset()

  useImageGeneratorStore.setState({
    presetId: 'gemini-3.1-flash-image',
    references: existing.map((item) => {
      return item.id
    }),
    uploadsById: uploadsOf(...existing),
  })
})

afterEach(closeMediaPicker)

describe('image reference cap', () => {
  it('reports the shared reason for each blocked image', () => {
    const extra = upload('image-cap-extra', 'image')
    const foreign = upload('video-cap-extra', 'video')

    expect(imageCanAdd(required(existing[0], 'existing image'))).toBe(REFERENCE_ALREADY_ATTACHED)
    expect(imageCanAdd(extra)).toBe(REFERENCE_LIMIT_REACHED)
    expect(imageCanAdd(foreign)).toBe(REFERENCE_ONLY_IMAGES)
  })

  it('clamps a picker add at the preset cap and toasts the skipped count', () => {
    const extra = upload('image-cap-extra', 'image')

    openReferencePicker()

    const request = useMediaPickerStore.getState().request

    if (request?.mode.kind !== 'toggle') {
      throw new Error('expected a toggle picker')
    }

    request.mode.onAdd(extra)

    expect(useImageGeneratorStore.getState().references).toHaveLength(14)

    expect(useImageGeneratorStore.getState().references).not.toContain(extra.id)

    expect(toast).toHaveBeenCalledWith('Skipped 1 file (Reference limit reached)')
  })
})
