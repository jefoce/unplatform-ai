// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { EndpointRowDraft } from '@/features/settings/endpoint-draft'
import { EndpointRow } from '@/features/settings/EndpointRow'

afterEach(() => {
  cleanup()
})

function row(overrides: Partial<EndpointRowDraft> = {}): EndpointRowDraft {
  return {
    key: 'row-1',
    id: '11111111-1111-4111-8111-111111111111',
    label: 'Studio',
    badge: 'CU1',
    baseUrl: 'http://127.0.0.1:8188',
    enabled: true,
    pricing: { mode: 'model', usd: 0 },
    instanceId: null,
    lastHealth: null,
    videoCount: 0,
    imageCount: 0,
    runningJobs: 0,
    status: 'unknown',
    tokenValue: '',
    isTokenRemoved: false,
    hasToken: false,
    tokenHint: null,
    isExpanded: true,
    isRemoved: false,
    isTesting: false,
    test: null,
    ...overrides,
  }
}

function renderRow(target: EndpointRowDraft, rows: EndpointRowDraft[] = [target]) {
  render(<EndpointRow row={target} rows={rows} onChange={vi.fn()} onTest={vi.fn()} />)
}

describe('endpoint row warnings', () => {
  it('shows how many running jobs a delete will fail', () => {
    renderRow(row({ isRemoved: true, runningJobs: 2 }))

    expect(screen.getByText('Will be removed')).toBeTruthy()
    expect(screen.getByText('2 running jobs on this endpoint will fail')).toBeTruthy()
  })

  it('shows the same ComfyUI instance as the other badge', () => {
    const first = row({ instanceId: 'same', isExpanded: true })
    const second = row({ key: 'row-2', id: null, badge: 'CU2', instanceId: 'same' })

    renderRow(first, [first, second])

    expect(screen.getByText('Same ComfyUI as CU2')).toBeTruthy()
  })

  it('checks the badge live', () => {
    const first = row({ isExpanded: true })
    const second = row({ key: 'row-2', id: null, badge: 'CU1' })

    renderRow(first, [first, second])

    expect(screen.getByText('Badge CU1 is already used')).toBeTruthy()
  })
})

describe('endpoint token removal', () => {
  it('marks the stored token for removal and clears the flag when typing', () => {
    const onChange = vi.fn()
    const withToken = row({ hasToken: true, tokenHint: '1234' })

    const first = render(
      <EndpointRow row={withToken} rows={[withToken]} onChange={onChange} onTest={vi.fn()} />,
    )

    fireEvent.click(screen.getByText('Remove token'))

    expect(onChange).toHaveBeenCalledWith('row-1', { isTokenRemoved: true, tokenValue: '' })

    first.unmount()
    onChange.mockClear()

    const removing = row({ hasToken: true, tokenHint: '1234', isTokenRemoved: true })

    render(<EndpointRow row={removing} rows={[removing]} onChange={onChange} onTest={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Token (optional)'), {
      target: { value: 'new-token' },
    })

    expect(onChange).toHaveBeenCalledWith('row-1', {
      tokenValue: 'new-token',
      isTokenRemoved: false,
    })
  })

  it('shows remove only when a token is stored, even without a hint', () => {
    const hinted = row({ hasToken: false, tokenHint: '1234' })

    const first = render(
      <EndpointRow row={hinted} rows={[hinted]} onChange={vi.fn()} onTest={vi.fn()} />,
    )

    expect(screen.queryByText('Remove token')).toBeNull()

    first.unmount()

    const shortToken = row({ hasToken: true, tokenHint: null })

    render(<EndpointRow row={shortToken} rows={[shortToken]} onChange={vi.fn()} onTest={vi.fn()} />)

    expect(screen.getByText('Remove token')).toBeTruthy()
  })
})
