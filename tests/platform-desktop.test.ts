import { describe, expect, it, vi } from 'vitest'

import { desktopPlatform } from '@/lib/platform/desktop'

import { messageOf } from '../src/core/errors'
import { record } from './helpers/history'

const mocks = vi.hoisted(() => {
  return {
    exportBatch: vi.fn(),
    exportImageBatch: vi.fn(),
    invoke: vi.fn(),
    open: vi.fn(),
    openPath: vi.fn(),
    resolveResource: vi.fn(),
  }
})

vi.mock('@tauri-apps/api/core', () => {
  class Channel {
    onmessage: ((message: unknown) => void) | null = null
  }

  return { Channel, invoke: mocks.invoke }
})

vi.mock('@tauri-apps/api/webview', () => {
  return { getCurrentWebview: vi.fn() }
})

vi.mock('@tauri-apps/plugin-dialog', () => {
  return { ask: vi.fn(), open: mocks.open, save: vi.fn() }
})

vi.mock('@tauri-apps/plugin-notification', () => {
  return { isPermissionGranted: vi.fn(), requestPermission: vi.fn(), sendNotification: vi.fn() }
})

vi.mock('@tauri-apps/api/path', () => {
  return { resolveResource: mocks.resolveResource }
})

vi.mock('@tauri-apps/plugin-opener', () => {
  return { openPath: mocks.openPath, openUrl: vi.fn() }
})

vi.mock('@/lib/api/folders', () => {
  return { createFolder: vi.fn() }
})

vi.mock('@/lib/api/generations', () => {
  return { exportBatch: mocks.exportBatch, exportRecord: vi.fn() }
})

vi.mock('@/lib/api/images', () => {
  return { exportImageBatch: mocks.exportImageBatch }
})

describe('desktop bundled links', () => {
  it('opens the license by resource name', async () => {
    const path = '/Applications/Unplatform AI.app/Contents/Resources/LICENSE'

    mocks.resolveResource.mockResolvedValue(path)
    mocks.openPath.mockResolvedValue(undefined)

    await desktopPlatform.openLicense()

    expect(mocks.resolveResource).toHaveBeenCalledWith('LICENSE')

    expect(mocks.openPath).toHaveBeenCalledWith(path)
  })

  it('logs the resource name and rethrows when opening fails', async () => {
    mocks.resolveResource.mockResolvedValue('/tmp/THIRD_PARTY_NOTICES.md')
    mocks.openPath.mockRejectedValue('no handler')
    mocks.invoke.mockResolvedValue(undefined)

    const error = await desktopPlatform.openNotices().catch((caught: unknown) => {
      return caught
    })

    expect(messageOf(error)).toBe('no handler')

    expect(mocks.invoke).toHaveBeenCalledWith('log_client_error', {
      resource: 'THIRD_PARTY_NOTICES.md',
      message: 'no handler',
    })
  })
})

describe('desktop update install', () => {
  it('keeps the string reason from a rejected invoke', async () => {
    mocks.invoke.mockRejectedValue('signature verification failed')

    const error = await desktopPlatform
      .installUpdate(() => {})
      .catch((caught: unknown) => {
        return caught
      })

    expect(error).toBeInstanceOf(Error)
    expect(messageOf(error)).toBe('signature verification failed')
  })
})

describe('desktop batch export', () => {
  it('counts the files the route skipped', async () => {
    mocks.invoke.mockResolvedValue('/tmp/videos')

    mocks.exportBatch.mockResolvedValue({
      saved: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
      skipped: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', reason: 'not_ready' }],
    })

    const result = await desktopPlatform.saveVideos([
      record('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
      record('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
    ])

    expect(mocks.invoke).toHaveBeenCalledWith('choose_export_folder', { uses: 1 })
    expect(result).toEqual({ saved: 1, skipped: 1, folder: '/tmp/videos' })
  })

  it('stops when the folder dialog is canceled', async () => {
    mocks.invoke.mockResolvedValue(null)

    const result = await desktopPlatform.saveVideos([
      record('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    ])

    expect(result).toEqual({ saved: 0, skipped: 0 })
    expect(mocks.exportBatch).not.toHaveBeenCalled()
  })
})

describe('desktop image export', () => {
  it('counts the images the route skipped', async () => {
    mocks.invoke.mockResolvedValue('/tmp/images')

    mocks.exportImageBatch.mockResolvedValue({
      saved: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
      skipped: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', reason: 'not_ready' }],
    })

    const result = await desktopPlatform.saveImages([
      {
        recordId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        outputId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        file: 'a.png',
      },
      {
        recordId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        outputId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        file: 'b.png',
      },
    ])

    expect(mocks.invoke).toHaveBeenCalledWith('choose_export_folder', { uses: 1 })

    expect(mocks.exportImageBatch).toHaveBeenCalledWith({
      outputs: [
        {
          recordId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          outputId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        },
        {
          recordId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          outputId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        },
      ],
      dir: '/tmp/images',
    })

    expect(result).toEqual({ saved: 1, skipped: 1, folder: '/tmp/images' })
  })
})
