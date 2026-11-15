/* eslint-disable max-lines -- save dialog cases stay in one suite */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HISTORY_BATCH_MAX } from '@/core/constants'
import { desktopPlatform } from '@/lib/platform/desktop'

import { messageOf } from '../src/core/errors'
import { record } from './helpers/history'

const mocks = vi.hoisted(() => {
  return {
    exportBatch: vi.fn(),
    exportImage: vi.fn(),
    exportImageBatch: vi.fn(),
    exportRecord: vi.fn(),
    invoke: vi.fn(),
    open: vi.fn(),
    openPath: vi.fn(),
    resolveResource: vi.fn(),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
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
  return { exportBatch: mocks.exportBatch, exportRecord: mocks.exportRecord }
})

vi.mock('@/lib/api/images', () => {
  return { exportImage: mocks.exportImage, exportImageBatch: mocks.exportImageBatch }
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

  it('shows friendly text and logs the raw failure when opening fails', async () => {
    const path = '/Applications/Unplatform AI.app/Contents/Resources/LICENSE'

    mocks.resolveResource.mockResolvedValue(path)
    mocks.openPath.mockRejectedValue(new Error(`no handler for ${path}`))
    mocks.invoke.mockResolvedValue(undefined)

    const error = await desktopPlatform.openLicense().catch((caught: unknown) => {
      return caught
    })

    expect(messageOf(error)).toBe('The app could not open that file.')

    expect(mocks.invoke).toHaveBeenCalledWith('log_client_error', {
      resource: 'LICENSE',
      message: `no handler for ${path}`,
    })

    const logged = mocks.invoke.mock.calls.find((call) => {
      return call[0] === 'log_client_error'
    })

    expect(String(logged?.[1].message)).toContain(path)
  })
})

describe('desktop update install', () => {
  it('translates a rejected invoke and logs the raw reason', async () => {
    mocks.invoke.mockRejectedValue('signature verification failed')

    const error = await desktopPlatform
      .installUpdate(() => {})
      .catch((caught: unknown) => {
        return caught
      })

    expect(error).toBeInstanceOf(Error)

    expect(messageOf(error)).toBe(
      'The update could not be verified. Download it from the release page.',
    )

    const logged = mocks.invoke.mock.calls.find((call) => {
      return call[0] === 'log_client_error'
    })

    expect(logged?.[1].message).toBe('signature verification failed')
  })

  it('falls back to generic text for an unknown error', async () => {
    mocks.invoke.mockRejectedValue('UnknownError')

    const error = await desktopPlatform
      .installUpdate(() => {})
      .catch((caught: unknown) => {
        return caught
      })

    expect(messageOf(error)).toBe('The app could not complete that action.')
  })
})

describe('desktop app info', () => {
  it('reports an action that the build does not allow', async () => {
    mocks.invoke.mockRejectedValue('Command update_info not allowed by ACL')

    const error = await desktopPlatform.appInfo().catch((caught: unknown) => {
      return caught
    })

    expect(messageOf(error)).toBe('This action is not available in this build. Update the app.')
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

  it('translates a forbidden export into short user text', async () => {
    mocks.invoke.mockResolvedValue('/tmp/videos')
    mocks.exportBatch.mockRejectedValue(new Error('Forbidden'))

    const error = await desktopPlatform
      .saveVideos([record('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')])
      .catch((caught: unknown) => {
        return caught
      })

    expect(messageOf(error)).toBe('The app cannot write to that location. Pick it again.')
  })

  it('reports the files saved before a later chunk fails', async () => {
    const records = Array.from({ length: HISTORY_BATCH_MAX + 1 }, () => {
      return record(crypto.randomUUID())
    })

    mocks.invoke.mockResolvedValue('/tmp/videos')

    mocks.exportBatch
      .mockResolvedValueOnce({
        saved: records.slice(0, HISTORY_BATCH_MAX).map((entry) => {
          return entry.id
        }),
        skipped: [],
      })
      .mockRejectedValueOnce(new Error('Forbidden'))

    const error = await desktopPlatform.saveVideos(records).catch((caught: unknown) => {
      return caught
    })

    expect(mocks.invoke).toHaveBeenCalledWith('choose_export_folder', { uses: 2 })

    expect(messageOf(error)).toBe(
      'Saved 200 of 201 files before the error. The app cannot write to that location. Pick it again.',
    )

    const logged = mocks.invoke.mock.calls.find((call) => {
      return call[0] === 'log_client_error'
    })

    expect(logged?.[1].message).toBe('Forbidden')
  })
})

describe('desktop single export', () => {
  it('translates a missing video into short user text', async () => {
    mocks.invoke.mockResolvedValue('/tmp/video.mp4')
    mocks.exportRecord.mockRejectedValue(new Error('Video not found'))

    const error = await desktopPlatform
      .saveVideo(record('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'))
      .catch((caught: unknown) => {
        return caught
      })

    expect(messageOf(error)).toBe('The file is no longer on disk.')
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
        name: 'wan-3-0',
      },
      {
        recordId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        outputId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        file: 'b.png',
        name: 'wan-3-1',
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

describe('desktop single image export', () => {
  it('opens the save dialog with the model name and real extension', async () => {
    mocks.invoke.mockResolvedValue('/tmp/wan-3-0.png')
    mocks.exportImage.mockResolvedValue({ path: '/tmp/wan-3-0.png' })

    const result = await desktopPlatform.saveImages([
      {
        recordId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        outputId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        file: 'a.png',
        name: 'wan-3-0',
      },
    ])

    expect(mocks.invoke).toHaveBeenCalledWith('choose_export_path', {
      defaultName: 'wan-3-0.png',
      extension: 'png',
    })

    expect(mocks.exportImage).toHaveBeenCalledWith({
      recordId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      outputId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      path: '/tmp/wan-3-0.png',
    })

    expect(result).toEqual({ saved: 1, skipped: 0 })
  })

  it('does nothing when the save dialog is canceled', async () => {
    mocks.invoke.mockResolvedValue(null)

    const result = await desktopPlatform.saveImages([
      {
        recordId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        outputId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        file: 'a.png',
        name: 'wan-3-0',
      },
    ])

    expect(result).toEqual({ saved: 0, skipped: 0 })
    expect(mocks.exportImage).not.toHaveBeenCalled()
  })

  it('passes a jpg extension unchanged', async () => {
    mocks.invoke.mockResolvedValue('/tmp/wan-3-0.jpg')
    mocks.exportImage.mockResolvedValue({ path: '/tmp/wan-3-0.jpg' })

    await desktopPlatform.saveImages([
      {
        recordId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        outputId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        file: 'a.jpg',
        name: 'wan-3-0',
      },
    ])

    expect(mocks.invoke).toHaveBeenCalledWith('choose_export_path', {
      defaultName: 'wan-3-0.jpg',
      extension: 'jpg',
    })
  })
})
