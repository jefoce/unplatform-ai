// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SessionPage from '@/app/session/page'

const startSession = vi.hoisted(() => {
  return vi.fn()
})

vi.mock('@/lib/api/system', () => {
  return { startSession }
})

beforeEach(() => {
  window.location.hash = '#t=session-token'
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('session page', () => {
  it('starts the session with the fragment token', async () => {
    startSession.mockResolvedValue(undefined)

    render(<SessionPage />)

    await waitFor(() => {
      expect(startSession).toHaveBeenCalledWith('session-token')
    })
  })

  it('shows the error when the session fails', async () => {
    startSession.mockRejectedValue(new Error('bad token'))

    render(<SessionPage />)

    expect(await screen.findByText('Could not start a session. Open the app again.')).toBeTruthy()
  })
})
