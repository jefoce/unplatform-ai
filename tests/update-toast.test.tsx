// @vitest-environment jsdom
import { act, cleanup, render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useUpdateStore } from '@/features/updates/update-store'
import { UpdateToast } from '@/features/updates/UpdateToast'
import { useInstallUpdate } from '@/features/updates/use-install-update'
import type { UpdateListener } from '@/lib/platform/types'
import type { InstallResult } from '@/lib/platform/update-schemas'

const platformMock = vi.hoisted(() => {
  return {
    installUpdate: vi.fn(),
    openReleasePage: vi.fn(),
  }
})

const toastMock = vi.hoisted(() => {
  return Object.assign(vi.fn(), {
    loading: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  })
})

vi.mock('@/lib/platform', () => {
  return { platform: platformMock }
})

vi.mock('sonner', () => {
  return { toast: toastMock }
})

const update = { version: '0.2.1', notes: 'Fixes', date: null }

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  platformMock.installUpdate.mockReset()
  platformMock.openReleasePage.mockReset()
  toastMock.mockReset()
  toastMock.loading.mockReset()
  toastMock.error.mockReset()
  toastMock.dismiss.mockReset()

  useUpdateStore.setState({
    appInfo: { version: '0.2.0', installKind: 'macos', autoCheck: true, lastCheck: null },
    status: 'available',
    update,
    progress: null,
    error: null,
    isDismissed: false,
    lastCheck: null,
  })
})

afterEach(() => {
  cleanup()
})

describe('UpdateToast', () => {
  it('replaces the notice for the same version instead of stacking', async () => {
    render(<UpdateToast />)
    await flush()

    act(() => {
      useUpdateStore.getState().applyCheckResult({ ...update })
    })

    await flush()

    const options = toastMock.mock.calls.map((call) => {
      return call[1] as { id?: string; duration?: number }
    })

    expect(options).toHaveLength(2)

    const ids = options.map((option) => {
      return option.id
    })

    expect(new Set(ids)).toEqual(new Set([`update-${update.version}`]))
    expect(options[0]).toMatchObject({ duration: 20_000 })
  })

  it('keeps the notice up for 20 s', async () => {
    render(<UpdateToast />)
    await flush()

    expect(toastMock.mock.calls[0]?.[1]).toMatchObject({
      id: `update-${update.version}`,
      duration: 20_000,
    })
  })

  it('installs from the Update action', async () => {
    platformMock.installUpdate.mockResolvedValue({ cancelled: false })

    render(<UpdateToast />)
    await flush()

    const options = toastMock.mock.calls[0]?.[1] as { action: { onClick: () => void } }

    await act(async () => {
      options.action.onClick()
    })

    expect(platformMock.installUpdate).toHaveBeenCalledTimes(1)
  })
})

describe('useInstallUpdate', () => {
  it('follows downloading progress, then installing', async () => {
    let onProgress: UpdateListener | null = null
    let finish: ((result: InstallResult) => void) | null = null

    platformMock.installUpdate.mockImplementation((listener: UpdateListener) => {
      onProgress = listener

      return new Promise((resolve) => {
        finish = resolve
      })
    })

    const view = renderHook(() => {
      return useInstallUpdate()
    })

    let running: Promise<void> | undefined

    act(() => {
      running = view.result.current.run()
    })

    expect(toastMock.loading).toHaveBeenLastCalledWith('Downloading 0%', {
      id: 'update-progress',
    })

    act(() => {
      onProgress?.({ downloaded: 42, total: 100, phase: 'downloading' })
    })

    expect(toastMock.loading).toHaveBeenLastCalledWith('Downloading 42%', {
      id: 'update-progress',
    })

    expect(useUpdateStore.getState().status).toBe('downloading')

    act(() => {
      onProgress?.({ downloaded: 100, total: 100, phase: 'installing' })
    })

    expect(toastMock.loading).toHaveBeenLastCalledWith('Installing...', { id: 'update-progress' })
    expect(useUpdateStore.getState().status).toBe('installing')

    await act(async () => {
      finish?.({ cancelled: false })
      await running
    })
  })

  it('dismisses the progress toast on cancel', async () => {
    platformMock.installUpdate.mockResolvedValue({ cancelled: true })

    const view = renderHook(() => {
      return useInstallUpdate()
    })

    await act(async () => {
      await view.result.current.run()
    })

    expect(toastMock.dismiss).toHaveBeenCalledWith('update-progress')
    expect(useUpdateStore.getState()).toMatchObject({ status: 'available', isDismissed: true })
  })

  it('shows the failure on the progress toast id', async () => {
    platformMock.installUpdate.mockRejectedValue(new Error('boom'))

    const view = renderHook(() => {
      return useInstallUpdate()
    })

    await act(async () => {
      await view.result.current.run()
    })

    expect(toastMock.error).toHaveBeenCalledWith('boom', { id: 'update-progress' })
    expect(useUpdateStore.getState()).toMatchObject({ status: 'error', error: 'boom' })
  })
})
