// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GenerationTile } from '@/features/media-picker/picker/GenerationTile'
import { useMediaPickerStore } from '@/features/media-picker/picker/store'

import { imageItemsOf } from './helpers/image-history'
import { required } from './helpers/required'

const OUTPUT_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3400'

afterEach(() => {
  cleanup()
  useMediaPickerStore.setState({ request: null, outputUploads: {} })
})

describe('picker generation pick', () => {
  it('closes the picker after picking a generation', () => {
    const [item] = imageItemsOf([OUTPUT_ID])
    const onPick = vi.fn()
    const onAdd = vi.fn()

    render(
      <GenerationTile
        item={required(item, 'image item')}
        modeKind="pick"
        output={{
          canAdd: () => {
            return null
          },
          onPick,
          onAdd,
          onToggle: onAdd,
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Use .* generation/ }))

    expect(onPick).toHaveBeenCalledTimes(1)
    expect(useMediaPickerStore.getState().request).toBeNull()
  })
})
