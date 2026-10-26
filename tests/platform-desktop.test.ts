import { describe, expect, it, vi } from 'vitest'

import { messageOf } from '@/core/errors'
import { desktopPlatform } from '@/lib/platform/desktop'

const { invokeMock } = vi.hoisted(() => {
  return { invokeMock: vi.fn() }
})

vi.mock('@tauri-apps/api/core', () => {
  class Channel {
    onmessage: ((message: unknown) => void) | null = null
  }

  return { Channel, invoke: invokeMock }
})

vi.mock('@tauri-apps/api/webview', () => {
  return { getCurrentWebview: vi.fn() }
})

vi.mock('@tauri-apps/plugin-dialog', () => {
  return { ask: vi.fn(), open: vi.fn(), save: vi.fn() }
})

vi.mock('@tauri-apps/plugin-notification', () => {
  return { isPermissionGranted: vi.fn(), requestPermission: vi.fn(), sendNotification: vi.fn() }
})

vi.mock('@tauri-apps/plugin-opener', () => {
  return { openUrl: vi.fn() }
})

vi.mock('@/lib/api/folders', () => {
  return { createFolder: vi.fn() }
})

vi.mock('@/lib/api/generations', () => {
  return { exportBatch: vi.fn(), exportRecord: vi.fn() }
})

describe('desktop update install', () => {
  it('keeps the string reason from a rejected invoke', async () => {
    invokeMock.mockRejectedValue('signature verification failed')

    const error = await desktopPlatform
      .installUpdate(() => {})
      .catch((caught: unknown) => {
        return caught
      })

    expect(error).toBeInstanceOf(Error)
    expect(messageOf(error)).toBe('signature verification failed')
  })
})
