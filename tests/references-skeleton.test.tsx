// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ReferencesBox } from '@/features/generator/references/ReferencesBox'
import { useGeneratorStore } from '@/features/generator/store/store'

import { upload, uploadsOf } from './helpers/validation-fixtures'

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const image = upload('image-1', 'image')

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)

  useGeneratorStore.setState({
    presetId: 'wan-3.0',
    tab: 'references',
    references: [image.id],
    uploadsById: {},
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('video reference skeleton', () => {
  it('shows a skeleton until the upload resolves', () => {
    const view = render(<ReferencesBox isUploadsLoading />)

    expect(document.querySelector('[data-reference-skeleton]')).not.toBeNull()

    act(() => {
      useGeneratorStore.setState({ uploadsById: uploadsOf(image) })
    })

    view.rerender(<ReferencesBox isUploadsLoading={false} />)

    expect(screen.getByAltText(image.originalName)).not.toBeNull()
    expect(document.querySelector('[data-reference-skeleton]')).toBeNull()
  })
})
