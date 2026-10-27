// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { WindowDropOverlay } from '@/features/media-input/WindowDropOverlay'

afterEach(cleanup)

describe('WindowDropOverlay', () => {
  it('renders while dragging and hides after', () => {
    const view = render(<WindowDropOverlay isDragging hint="as references" />)

    expect(screen.getByText('Drop to add')).toBeDefined()
    expect(screen.getByText('as references')).toBeDefined()

    view.rerender(<WindowDropOverlay isDragging={false} hint="as references" />)

    expect(screen.queryByText('Drop to add')).toBeNull()
  })
})
