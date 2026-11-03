// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FilterPopover } from '@/features/history/filters/FilterPopover'
import { HistoryFilterForm } from '@/features/history/filters/HistoryFilterForm'
import { useHistoryViewStore } from '@/features/history/list/view-store'

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const search = () => {
  return screen.findByRole('textbox', { name: 'Search prompts' })
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)
  useHistoryViewStore.getState().resetFilters()
})

afterEach(() => {
  cleanup()
  useHistoryViewStore.getState().resetFilters()
  vi.unstubAllGlobals()
})

describe('filter popover search', () => {
  it('applies a pending search when the filter closes', async () => {
    render(
      <FilterPopover activeCount={0}>
        <HistoryFilterForm />
      </FilterPopover>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Filter/ }))

    const input = await search()

    fireEvent.change(input, { target: { value: '  cat  ' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: 'Search prompts' })).toBeNull()
    })

    expect(useHistoryViewStore.getState().filters.q).toBe('cat')
  })
})
