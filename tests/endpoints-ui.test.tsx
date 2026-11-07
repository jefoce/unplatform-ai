// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
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
