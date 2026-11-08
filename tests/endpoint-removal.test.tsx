// @vitest-environment jsdom
import { createRef, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CustomEndpointSection } from '@/features/settings/CustomEndpointSection'
import type { EndpointRowDraft, EndpointsDraft } from '@/features/settings/endpoint-draft'

import { Observer } from './helpers/history'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)
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
    isExpanded: false,
    isRemoved: false,
    isTesting: false,
    test: null,
    ...overrides,
  }
}

function Harness(props: { initial: EndpointRowDraft[] }) {
  const [rows, setRows] = useState(props.initial)

  const draft: EndpointsDraft = {
    rows,
    nextBadge: 'CU9',
    isLoading: false,
    isDirty: false,
    isValid: true,
    onAdd: () => {},
    onChange: (key, patch) => {
      setRows((current) => {
        return current.map((item) => {
          if (item.key !== key) {
            return item
          }

          return { ...item, ...patch }
        })
      })
    },
    onTest: () => {},
    onSave: () => {
      return Promise.resolve()
    },
    reset: () => {},
  }

  return <CustomEndpointSection sectionRef={createRef()} draft={draft} />
}

describe('endpoint removal notice', () => {
  it('removes the row from the list and shows the notice', async () => {
    render(<Harness initial={[row({ runningJobs: 2 })]} />)

    expect(screen.getByText('Studio')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Endpoint menu'))
    fireEvent.click(await screen.findByText('Delete'))

    expect(screen.queryByText('Studio')).toBeNull()
    expect(screen.getByText('CU1 removed. 2 running jobs will fail when you save.')).toBeTruthy()
  })

  it('counts zero, one and many running jobs', () => {
    render(
      <Harness
        initial={[
          row({ key: 'row-1', badge: 'CU1', isRemoved: true, runningJobs: 0 }),
          row({ key: 'row-2', badge: 'CU2', isRemoved: true, runningJobs: 1 }),
          row({ key: 'row-3', badge: 'CU3', isRemoved: true, runningJobs: 2 }),
        ]}
      />,
    )

    expect(screen.getByText('CU1 removed.')).toBeTruthy()
    expect(screen.getByText('CU2 removed. 1 running job will fail when you save.')).toBeTruthy()
    expect(screen.getByText('CU3 removed. 2 running jobs will fail when you save.')).toBeTruthy()
    expect(screen.getAllByText('Undo')).toHaveLength(3)
  })

  it('puts the row back on Undo', () => {
    render(<Harness initial={[row({ isRemoved: true })]} />)

    expect(screen.queryByText('Studio')).toBeNull()

    fireEvent.click(screen.getByText('Undo'))

    expect(screen.getByText('Studio')).toBeTruthy()
    expect(screen.queryByText('CU1 removed.')).toBeNull()
  })
})
