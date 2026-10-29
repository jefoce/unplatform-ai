// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { StatusOverlay } from '@/features/history/status/StatusOverlay'

import { Observer, record } from './helpers/history'

vi.mock('@/lib/fetcher', () => {
  return {
    apiPost: vi.fn(),
    apiDelete: vi.fn(),
    apiPatch: vi.fn(),
    fetcher: vi.fn(),
    ApiError: class ApiError extends Error {
      status = 0
    },
  }
})

vi.mock('@/lib/platform', () => {
  return {
    platform: { confirm: vi.fn(), saveVideo: vi.fn(), saveVideos: vi.fn() },
  }
})

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: vi.fn() } }
})

const SUBMITTED_AT = '2026-01-01T00:00:00.000Z'

const failedRecord = (overrides: Partial<GenerationRecord>): GenerationRecord => {
  return {
    ...record('failed', { status: 'failed', error: 'Download failed: gone' }),
    output: undefined,
    ...overrides,
  }
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('ResizeObserver', Observer)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Retry download button', () => {
  it('shows for a failed copy with a provider job and no expiry', () => {
    render(
      <StatusOverlay
        record={failedRecord({
          job: { id: 'or-job-4242', submittedAt: SUBMITTED_AT },
        })}
      />,
    )

    expect(screen.getByRole('button', { name: 'Retry download' })).not.toBeNull()
  })

  it('is absent when the record failed outside the download', () => {
    render(
      <StatusOverlay
        record={failedRecord({
          error: 'Provider error: job expired',
          downloadFailed: false,
          job: { id: 'or-job-4242', submittedAt: SUBMITTED_AT },
        })}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Retry download' })).toBeNull()
  })

  it('shows for a legacy record whose error text says the download failed', () => {
    render(
      <StatusOverlay
        record={failedRecord({
          error: 'Download failed: gone',
          downloadFailed: undefined,
          job: { id: 'or-job-4242', submittedAt: SUBMITTED_AT },
        })}
      />,
    )

    expect(screen.getByRole('button', { name: 'Retry download' })).not.toBeNull()
  })

  it('is absent when the provider copy expired', () => {
    render(
      <StatusOverlay
        record={failedRecord({
          job: {
            id: 'or-job-4242',
            submittedAt: SUBMITTED_AT,
            expiresAt: Date.now() - 1000,
          },
        })}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Retry download' })).toBeNull()
  })

  it('is absent when the failed record has no provider job', () => {
    render(<StatusOverlay record={failedRecord({})} />)

    expect(screen.queryByRole('button', { name: 'Retry download' })).toBeNull()
  })
})
