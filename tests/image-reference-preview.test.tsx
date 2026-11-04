// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { isNil } from 'lodash-es'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ImageReferences } from '@/features/image-generator/ImageReferences'
import { useImageGeneratorStore } from '@/features/image-generator/store'
import { closePreview, usePreviewStore } from '@/features/preview/preview-store'

import { upload, uploadsOf } from './helpers/validation-fixtures'

const first = upload('image-1', 'image')
const second = upload('image-2', 'image')

beforeEach(() => {
  useImageGeneratorStore.setState({
    references: [first.id, second.id],
    uploadsById: uploadsOf(first, second),
  })
})

afterEach(() => {
  cleanup()
  closePreview()
})

describe('image reference chip size', () => {
  it('renders each chip at 64 px', () => {
    render(<ImageReferences />)

    const row = document.querySelector('[data-image-references]')
    const chips = row?.querySelectorAll(':scope > div')

    expect(chips).toHaveLength(2)

    for (const chip of chips ?? []) {
      expect(chip.className).toContain('size-16')
    }
  })

  it('renders the references row at 64 px', () => {
    render(<ImageReferences />)

    const row = document.querySelector('[data-image-references]')

    expect(row?.className).toContain('h-16')
  })
})

describe('image reference chip preview', () => {
  it('opens the clicked chip in order and removes it through the preview action', () => {
    render(<ImageReferences />)

    fireEvent.click(screen.getByRole('button', { name: 'Preview image-2.png' }))

    const request = usePreviewStore.getState().request

    if (isNil(request)) {
      throw new Error('preview request missing')
    }

    expect(
      request.items.map((item) => {
        return item.id
      }),
    ).toEqual(['image-1', 'image-2'])

    expect(request.index).toBe(1)
    expect(request.allowUse).toBe(false)
    expect(request.actions?.available?.(second)).toEqual(['remove', 'replace'])

    act(() => {
      request.actions?.remove?.(second)
    })

    expect(useImageGeneratorStore.getState().references).toEqual(['image-1'])
  })
})
