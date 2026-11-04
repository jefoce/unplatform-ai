// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SelectionToolbar } from '@/features/history/selection/SelectionToolbar'

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

interface ToolbarParams {
  isActive: boolean
}

function renderToolbar(params: ToolbarParams): HTMLElement {
  const result = render(
    <SelectionToolbar
      isActive={params.isActive}
      count={2}
      kind="video"
      stack={[]}
      byId={new Map()}
      completedCount={1}
      isBusy={false}
      onDownload={vi.fn()}
      onDelete={vi.fn()}
      onClear={vi.fn()}
    />,
  )

  const toolbar = result.container.querySelector<HTMLElement>('[role="toolbar"]')

  if (toolbar === null) {
    throw new Error('Missing toolbar')
  }

  return toolbar
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('SelectionToolbar', () => {
  it('takes the hidden toolbar out of reach', () => {
    const toolbar = renderToolbar({ isActive: false })
    const buttons = [...toolbar.querySelectorAll('button')]

    expect(toolbar.hasAttribute('inert')).toBe(true)
    expect(buttons.length).toBeGreaterThan(0)

    for (const button of buttons) {
      expect(button.closest('[inert]')).toBe(toolbar)
    }
  })

  it('keeps the visible toolbar tabbable', () => {
    const toolbar = renderToolbar({ isActive: true })

    expect(toolbar.hasAttribute('inert')).toBe(false)

    for (const button of toolbar.querySelectorAll('button')) {
      expect(button.closest('[inert]')).toBeNull()
    }
  })
})
