// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { RecordKind } from '@/core/feed/grid-item'
import { EmptyState } from '@/features/history/list/EmptyState'

afterEach(cleanup)

interface EmptyCase {
  kind: RecordKind
  title: string
  body: string
}

const CASES: EmptyCase[] = [
  { kind: 'video', title: 'No generations yet', body: 'Generated videos will appear here.' },
  { kind: 'image', title: 'No images yet', body: 'Generated images will appear here.' },
]

describe.each(CASES)('$kind feed', (testCase) => {
  it('renders the shared empty state with its copy and icon', () => {
    const { container } = render(<EmptyState kind={testCase.kind} />)

    expect(screen.getByText(testCase.title)).not.toBeNull()
    expect(screen.getByText(testCase.body)).not.toBeNull()
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })
})
