// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppSection } from '@/features/updates/AppSection'
import { useUpdateStore } from '@/features/updates/update-store'

const platformMock = vi.hoisted(() => {
  return {
    appInfo: vi.fn(),
    checkUpdate: vi.fn(),
    installUpdate: vi.fn(),
    setAutoCheck: vi.fn(),
    openReleasePage: vi.fn(),
  }
})

vi.mock('@/lib/platform', () => {
  return { platform: platformMock }
})

const update = { version: '0.3.0', notes: 'Fixes', date: null }

beforeEach(() => {
  platformMock.setAutoCheck.mockReset()
  platformMock.openReleasePage.mockReset()
  platformMock.checkUpdate.mockReset()
  platformMock.setAutoCheck.mockResolvedValue(undefined)
  platformMock.openReleasePage.mockResolvedValue(undefined)

  useUpdateStore.setState({
    appInfo: null,
    status: 'idle',
    update: null,
    progress: null,
    error: null,
    isDismissed: false,
    lastCheck: null,
  })
})

afterEach(() => {
  cleanup()
})

describe('AppSection linux package', () => {
  it('hides the install button and shows Download when available', () => {
    useUpdateStore.setState({
      appInfo: {
        version: '0.2.0',
        installKind: 'linux-package',
        autoCheck: true,
        lastCheck: null,
      },
      status: 'available',
      update,
    })

    render(<AppSection />)

    expect(screen.queryByRole('button', { name: 'Install and restart' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Download' }))
    expect(platformMock.openReleasePage).toHaveBeenCalledTimes(1)
  })

  it('hides Download on linux-package when up to date', () => {
    useUpdateStore.setState({
      appInfo: {
        version: '0.2.0',
        installKind: 'linux-package',
        autoCheck: true,
        lastCheck: null,
      },
      status: 'upToDate',
      update: null,
    })

    render(<AppSection />)

    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
  })
})

describe('AppSection', () => {
  it('shows only the version line in the browser', () => {
    useUpdateStore.setState({
      appInfo: {
        version: '0.2.0',
        installKind: 'browser',
        autoCheck: false,
        lastCheck: null,
      },
    })

    render(<AppSection />)

    expect(screen.getByText('Unplatform AI 0.2.0')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Check now' })).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('shows Install and restart on macOS when an update is available', () => {
    useUpdateStore.setState({
      appInfo: {
        version: '0.2.0',
        installKind: 'macos',
        autoCheck: true,
        lastCheck: null,
      },
      status: 'available',
      update,
    })

    render(<AppSection />)

    expect(screen.getByRole('button', { name: 'Install and restart' })).toBeTruthy()
    expect(screen.getByText('Version 0.3.0 is available')).toBeTruthy()
  })

  it('shows the download percentage', () => {
    useUpdateStore.setState({
      appInfo: {
        version: '0.2.0',
        installKind: 'appimage',
        autoCheck: true,
        lastCheck: null,
      },
      status: 'downloading',
      update,
      progress: { downloaded: 42, total: 100, phase: 'downloading' },
    })

    render(<AppSection />)

    expect(screen.getByText('Downloading 42%')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Install and restart' })).toBeNull()
  })

  it('saves the automatic check switch', async () => {
    useUpdateStore.setState({
      appInfo: {
        version: '0.2.0',
        installKind: 'macos',
        autoCheck: true,
        lastCheck: null,
      },
    })

    render(<AppSection />)

    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() => {
      expect(platformMock.setAutoCheck).toHaveBeenCalledWith(false)
    })

    expect(useUpdateStore.getState().appInfo?.autoCheck).toBe(false)
  })
})
