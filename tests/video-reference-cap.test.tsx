// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { REFERENCE_LIMIT_REACHED } from '@/features/generator/reference-rules'
import { ReferencesBox } from '@/features/generator/references/ReferencesBox'
import { useGeneratorStore } from '@/features/generator/store/store'
import { closeMediaPicker, useMediaPickerStore } from '@/features/media-picker/picker/store'

import { required } from './helpers/required'
import { upload, uploadsOf } from './helpers/validation-fixtures'

const references = Array.from({ length: 10 }, (_, index) => {
  return upload(`image-${index}`, 'image')
})

beforeEach(() => {
  useGeneratorStore.setState({
    presetId: 'wan-3.0',
    references: references.map((item) => {
      return item.id
    }),
    uploadsById: uploadsOf(...references),
  })
})

afterEach(() => {
  cleanup()
  closeMediaPicker()
})

describe('video reference picker cap', () => {
  it('blocks a saved generation when the image references are full', () => {
    render(<ReferencesBox />)

    fireEvent.click(screen.getByRole('button', { name: /^Add references/ }))

    const request = required(useMediaPickerStore.getState().request, 'picker request')

    if (request.mode.kind !== 'toggle') {
      throw new Error('expected a toggle picker')
    }

    const reason = request.output?.canAdd?.({
      recordId: 'record-1',
      outputId: 'output-1',
      recordKind: 'image',
      favorite: false,
    })

    expect(reason).toBe(REFERENCE_LIMIT_REACHED)

    const uploadReason = request.mode.canAdd(upload('image-extra', 'image'))

    expect(uploadReason).toBe(REFERENCE_LIMIT_REACHED)
  })
})
