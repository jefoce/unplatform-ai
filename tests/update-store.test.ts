import { beforeEach, describe, expect, it } from 'vitest'

import { useUpdateStore } from '@/features/updates/update-store'

const update = { version: '0.3.0', notes: 'Fixes', date: null }

beforeEach(() => {
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

describe('update store', () => {
  it('moves from checking to available', () => {
    useUpdateStore.getState().startCheck()
    expect(useUpdateStore.getState().status).toBe('checking')

    useUpdateStore.getState().applyCheckResult(update)
    expect(useUpdateStore.getState()).toMatchObject({ status: 'available', update })
    expect(useUpdateStore.getState().lastCheck).not.toBeNull()
  })

  it('moves from checking to up to date', () => {
    useUpdateStore.getState().startCheck()
    useUpdateStore.getState().applyCheckResult(null)

    expect(useUpdateStore.getState()).toMatchObject({ status: 'upToDate', update: null })
  })

  it('tracks download and install progress', () => {
    useUpdateStore.getState().startInstall()
    expect(useUpdateStore.getState().status).toBe('downloading')

    useUpdateStore.getState().setProgress({ downloaded: 42, total: 100, phase: 'downloading' })
    expect(useUpdateStore.getState()).toMatchObject({ status: 'downloading' })

    useUpdateStore.getState().setProgress({ downloaded: 0, total: null, phase: 'installing' })
    expect(useUpdateStore.getState()).toMatchObject({ status: 'installing' })
  })

  it('stores and clears the error', () => {
    useUpdateStore.getState().markError('Signature mismatch')

    expect(useUpdateStore.getState()).toMatchObject({
      status: 'error',
      error: 'Signature mismatch',
    })
  })

  it('returns to available after a cancelled install and dismisses the toast', () => {
    useUpdateStore.getState().markError('Downloading stopped')
    useUpdateStore.getState().markCancelled(update)

    expect(useUpdateStore.getState()).toMatchObject({
      status: 'available',
      update,
      progress: null,
      error: null,
      isDismissed: true,
    })
  })

  it('dismisses the notice for the session', () => {
    useUpdateStore.getState().dismiss()
    expect(useUpdateStore.getState().isDismissed).toBe(true)
  })

  it('updates auto check on the stored app info', () => {
    useUpdateStore.getState().setAppInfo({
      version: '0.2.0',
      installKind: 'macos',
      autoCheck: true,
      lastCheck: null,
    })

    useUpdateStore.getState().setAutoCheckValue(false)
    expect(useUpdateStore.getState().appInfo?.autoCheck).toBe(false)
  })
})
