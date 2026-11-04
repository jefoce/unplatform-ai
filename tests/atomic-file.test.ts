import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => {
  return [] as string[]
})

const control = vi.hoisted(() => {
  return {
    linkError: null as null | Error,
    renameError: null as null | Error,
    existing: new Set<string>(),
  }
})

vi.mock('node:fs/promises', () => {
  return {
    default: {
      open: async (file: string, flags: string) => {
        calls.push(`open:${flags}:${file}`)

        return {
          sync: async () => {
            calls.push(`sync:${file}`)
          },
          close: async () => {
            calls.push(`close:${file}`)
          },
        }
      },
      rename: async (from: string, to: string) => {
        if (control.renameError) {
          throw control.renameError
        }

        calls.push(`rename:${from}:${to}`)
      },
      access: async (file: string) => {
        if (!control.existing.has(file)) {
          throw Object.assign(new Error(`missing ${file}`), { code: 'ENOENT' })
        }
      },
      link: async (from: string, to: string) => {
        if (control.linkError) {
          throw control.linkError
        }

        calls.push(`link:${from}:${to}`)
      },
      copyFile: async (from: string, to: string, flags: number) => {
        calls.push(`copyFile:${from}:${to}:${flags}`)
      },
      unlink: async (file: string) => {
        calls.push(`unlink:${file}`)
      },
    },
  }
})

const { commitFile, renameOrKeepExisting, retryOnWindowsLock } =
  await import('@/server/fs/atomic-file')

function winLock(code = 'EPERM'): Error {
  return Object.assign(new Error(`locked ${code}`), { code })
}

describe('retryOnWindowsLock', () => {
  it('commits a rename after two EPERM locks on win32', async () => {
    const rename = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(winLock())
      .mockRejectedValueOnce(winLock())
      .mockResolvedValue(undefined)

    const sleep = vi.fn(async () => {})

    await retryOnWindowsLock(rename, { platform: 'win32', sleep })

    expect(rename).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls).toEqual([[10], [20]])
  })

  it('rethrows after the full budget when the lock never clears', async () => {
    const error = winLock()
    const rename = vi.fn<() => Promise<void>>().mockRejectedValue(error)
    const sleep = vi.fn(async () => {})

    await expect(retryOnWindowsLock(rename, { platform: 'win32', sleep })).rejects.toBe(error)

    expect(rename).toHaveBeenCalledTimes(8)
    expect(sleep.mock.calls).toEqual([[10], [20], [40], [80], [160], [320], [640]])
  })

  it('does not retry off Windows', async () => {
    const error = winLock()
    const rename = vi.fn<() => Promise<void>>().mockRejectedValue(error)
    const sleep = vi.fn(async () => {})

    await expect(retryOnWindowsLock(rename, { platform: 'darwin', sleep })).rejects.toBe(error)
    await expect(retryOnWindowsLock(rename, { platform: 'linux', sleep })).rejects.toBe(error)

    expect(rename).toHaveBeenCalledTimes(2)
    expect(sleep).not.toHaveBeenCalled()
  })
})

describe('renameOrKeepExisting', () => {
  beforeEach(() => {
    calls.length = 0
    control.renameError = null
    control.existing.clear()
  })

  it('keeps an existing target once the lock retries run out', async () => {
    control.renameError = winLock()
    control.existing.add('/data/a.webp')

    await renameOrKeepExisting('/data/a.webp.tmp', '/data/a.webp')

    expect(calls).toEqual(['unlink:/data/a.webp.tmp'])
  })

  it('rethrows when the target is missing', async () => {
    const error = winLock()

    control.renameError = error

    await expect(renameOrKeepExisting('/data/a.webp.tmp', '/data/a.webp')).rejects.toBe(error)
  })
})

describe('commitFile', () => {
  beforeEach(() => {
    calls.length = 0
    control.linkError = null
    control.renameError = null
  })

  it('fsyncs the temp file, renames it, then fsyncs the parent directory', async () => {
    await commitFile({ temp: '/data/image.png.tmp', target: '/data/image.png' })

    expect(calls).toEqual([
      'open:r+:/data/image.png.tmp',
      'sync:/data/image.png.tmp',
      'close:/data/image.png.tmp',
      'rename:/data/image.png.tmp:/data/image.png',
      'open:r:/data',
      'sync:/data',
      'close:/data',
    ])
  })

  it('fsyncs then hard-links in exclusive mode, keeping any existing target', async () => {
    await commitFile({ temp: '/data/image.png.tmp', target: '/data/image.png', isExclusive: true })

    expect(calls).toEqual([
      'open:r+:/data/image.png.tmp',
      'sync:/data/image.png.tmp',
      'close:/data/image.png.tmp',
      'link:/data/image.png.tmp:/data/image.png',
      'unlink:/data/image.png.tmp',
      'open:r:/data',
      'sync:/data',
      'close:/data',
    ])
  })

  it('copies exclusively when hard links are unsupported', async () => {
    control.linkError = Object.assign(new Error('operation not permitted'), { code: 'EPERM' })

    await commitFile({ temp: '/data/image.png.tmp', target: '/data/image.png', isExclusive: true })

    expect(calls).toEqual([
      'open:r+:/data/image.png.tmp',
      'sync:/data/image.png.tmp',
      'close:/data/image.png.tmp',
      'copyFile:/data/image.png.tmp:/data/image.png:1',
      'unlink:/data/image.png.tmp',
      'open:r:/data',
      'sync:/data',
      'close:/data',
    ])
  })

  it('rethrows other link errors and still drops the temp file', async () => {
    control.linkError = Object.assign(new Error('disk error'), { code: 'EIO' })

    await expect(
      commitFile({ temp: '/data/image.png.tmp', target: '/data/image.png', isExclusive: true }),
    ).rejects.toThrow('disk error')

    expect(calls).toContain('unlink:/data/image.png.tmp')
  })
})
