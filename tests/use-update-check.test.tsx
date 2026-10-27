// @vitest-environment jsdom
import { act, cleanup, render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { UPDATE_CHECK_DELAY_MS, UPDATE_CHECK_INTERVAL_MS } from '@/core/constants'
import { checkForUpdate } from '@/features/updates/check-update'
import { useUpdateStore } from '@/features/updates/update-store'
import { UpdateToast } from '@/features/updates/UpdateToast'
import { useUpdateCheck } from '@/features/updates/use-update-check'

const platformMock = vi.hoisted(() => {
  return {
    appInfo: vi.fn(),
    checkUpdate: vi.fn(),
    installUpdate: vi.fn(),
    setAutoCheck: vi.fn(),
    openReleasePage: vi.fn(),
  }
})

const toastMock = vi.hoisted(() => {
  return vi.fn()
})

vi.mock('@/lib/platform', () => {
  return { platform: platformMock }
})

vi.mock('sonner', () => {
  return { toast: toastMock }
})

const update = { version: '0.3.0', notes: 'Fixes', date: null }

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  platformMock.appInfo.mockReset()
  platformMock.checkUpdate.mockReset()
  platformMock.installUpdate.mockReset()
  platformMock.setAutoCheck.mockReset()
  platformMock.openReleasePage.mockReset()
  toastMock.mockReset()

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
  vi.useRealTimers()
})

describe('useUpdateCheck', () => {
  it('does not check when auto check is off', async () => {
    platformMock.appInfo.mockResolvedValue({
      version: '0.2.0',
      installKind: 'macos',
      autoCheck: false,
      lastCheck: null,
    })

    renderHook(() => {
      useUpdateCheck()
    })

    await flush()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UPDATE_CHECK_DELAY_MS)
    })

    expect(platformMock.checkUpdate).not.toHaveBeenCalled()
  })

  it('starts checking when the switch turns on', async () => {
    platformMock.appInfo.mockResolvedValue({
      version: '0.2.0',
      installKind: 'macos',
      autoCheck: false,
      lastCheck: null,
    })

    platformMock.checkUpdate.mockResolvedValue(null)

    renderHook(() => {
      useUpdateCheck()
    })

    await flush()

    act(() => {
      useUpdateStore.getState().setAutoCheckValue(true)
    })

    expect(platformMock.checkUpdate).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UPDATE_CHECK_DELAY_MS)
    })

    expect(platformMock.checkUpdate).toHaveBeenCalledTimes(1)
  })

  it('stops checking when the switch turns off', async () => {
    platformMock.appInfo.mockResolvedValue({
      version: '0.2.0',
      installKind: 'macos',
      autoCheck: true,
      lastCheck: null,
    })

    platformMock.checkUpdate.mockResolvedValue(null)

    renderHook(() => {
      useUpdateCheck()
    })

    await flush()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UPDATE_CHECK_DELAY_MS)
    })

    expect(platformMock.checkUpdate).toHaveBeenCalledTimes(1)

    act(() => {
      useUpdateStore.getState().setAutoCheckValue(false)
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS)
    })

    expect(platformMock.checkUpdate).toHaveBeenCalledTimes(1)
  })

  it('does not check in the browser', async () => {
    platformMock.appInfo.mockResolvedValue({
      version: '0.2.0',
      installKind: 'browser',
      autoCheck: true,
      lastCheck: null,
    })

    renderHook(() => {
      useUpdateCheck()
    })

    await flush()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UPDATE_CHECK_DELAY_MS)
    })

    expect(platformMock.checkUpdate).not.toHaveBeenCalled()
  })
})

describe('useUpdateCheck checks', () => {
  it('checks after the start delay, then every 12 h', async () => {
    platformMock.appInfo.mockResolvedValue({
      version: '0.2.0',
      installKind: 'macos',
      autoCheck: true,
      lastCheck: null,
    })

    platformMock.checkUpdate.mockResolvedValue(null)

    renderHook(() => {
      useUpdateCheck()
    })

    await flush()
    expect(platformMock.checkUpdate).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UPDATE_CHECK_DELAY_MS)
    })

    expect(platformMock.checkUpdate).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS)
    })

    expect(platformMock.checkUpdate).toHaveBeenCalledTimes(2)
  })

  it('keeps a failed background check silent', async () => {
    platformMock.appInfo.mockResolvedValue({
      version: '0.2.0',
      installKind: 'macos',
      autoCheck: true,
      lastCheck: null,
    })

    platformMock.checkUpdate.mockRejectedValue(new Error('offline'))

    renderHook(() => {
      useUpdateCheck()
    })

    await flush()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UPDATE_CHECK_DELAY_MS)
    })

    expect(useUpdateStore.getState()).toMatchObject({ status: 'idle', error: null })
  })

  it('shows a failed manual check', async () => {
    platformMock.checkUpdate.mockRejectedValue(new Error('offline'))

    await act(async () => {
      await checkForUpdate(true)
    })

    expect(useUpdateStore.getState()).toMatchObject({ status: 'error', error: 'offline' })
  })
})

describe('UpdateToast', () => {
  it('shows the version once and keeps Later for the session', async () => {
    useUpdateStore.setState({
      appInfo: { version: '0.2.0', installKind: 'macos', autoCheck: true, lastCheck: null },
      status: 'available',
      update,
    })

    const view = render(<UpdateToast />)

    await flush()

    expect(toastMock).toHaveBeenCalledTimes(1)
    expect(toastMock.mock.calls[0]?.[0]).toBe('Version 0.3.0 is available')

    const options = toastMock.mock.calls[0]?.[1] as {
      cancel: { onClick: () => void }
    }

    act(() => {
      options.cancel.onClick()
    })

    expect(useUpdateStore.getState().isDismissed).toBe(true)

    view.unmount()
    render(<UpdateToast />)
    await flush()

    expect(toastMock).toHaveBeenCalledTimes(1)
  })
})
