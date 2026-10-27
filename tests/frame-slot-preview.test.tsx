// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { isNil } from 'lodash-es'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { FrameSlot } from '@/features/generator/frames/FrameSlot'
import { useGeneratorStore } from '@/features/generator/store/store'
import { closeMediaPicker, useMediaPickerStore } from '@/features/media-picker/picker/store'
import { closePreview, usePreviewStore } from '@/features/preview/preview-store'

import { upload, uploadsOf } from './helpers/validation-fixtures'

const startFrame = upload('start-frame', 'image')
const endFrame = upload('end-frame', 'image')

beforeEach(() => {
  useGeneratorStore.setState({
    presetId: 'wan-3.0',
    frames: { start: startFrame.id, end: endFrame.id },
    uploadsById: uploadsOf(startFrame, endFrame),
  })
})

afterEach(() => {
  cleanup()
  closePreview()
  closeMediaPicker()
})

describe('FrameSlot preview chain', () => {
  it('opens both frames in slot order and replaces the shown slot', () => {
    render(<FrameSlot slot="start" />)

    fireEvent.click(screen.getByRole('button', { name: 'Preview start frame' }))

    const request = usePreviewStore.getState().request

    if (isNil(request)) {
      throw new Error('preview request missing')
    }

    expect(
      request.items.map((item) => {
        return item.id
      }),
    ).toEqual(['start-frame', 'end-frame'])

    expect(request.index).toBe(0)

    const shown = request.items[1]

    if (isNil(shown)) {
      throw new Error('second frame missing')
    }

    act(() => {
      request.actions?.replace?.(shown)
    })

    const picker = useMediaPickerStore.getState().request

    if (isNil(picker)) {
      throw new Error('picker request missing')
    }

    const { mode } = picker

    if (mode.kind !== 'pick') {
      throw new Error('picker is not in pick mode')
    }

    const nextFrame = upload('next-end', 'image')

    act(() => {
      mode.onPick(nextFrame)
    })

    expect(useGeneratorStore.getState().frames.end).toBe('next-end')
    expect(useGeneratorStore.getState().uploadsById['next-end']).toEqual(nextFrame)
  })
})
