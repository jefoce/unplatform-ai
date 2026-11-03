import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => {
  return [] as string[]
})

const control = vi.hoisted(() => {
  return { linkError: null as null | Error }
})

vi.mock('node:fs/promises', () => {
  return {
    default: {
      open: async (file: string) => {
        calls.push(`open:${file}`)

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
        calls.push(`rename:${from}:${to}`)
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

const { commitFile } = await import('@/server/fs/atomic-file')

describe('commitFile', () => {
  beforeEach(() => {
    calls.length = 0
    control.linkError = null
  })

  it('fsyncs the temp file, renames it, then fsyncs the parent directory', async () => {
    await commitFile({ temp: '/data/image.png.tmp', target: '/data/image.png' })

    expect(calls).toEqual([
      'open:/data/image.png.tmp',
      'sync:/data/image.png.tmp',
      'close:/data/image.png.tmp',
      'rename:/data/image.png.tmp:/data/image.png',
      'open:/data',
      'sync:/data',
      'close:/data',
    ])
  })

  it('fsyncs then hard-links in exclusive mode, keeping any existing target', async () => {
    await commitFile({ temp: '/data/image.png.tmp', target: '/data/image.png', isExclusive: true })

    expect(calls).toEqual([
      'open:/data/image.png.tmp',
      'sync:/data/image.png.tmp',
      'close:/data/image.png.tmp',
      'link:/data/image.png.tmp:/data/image.png',
      'unlink:/data/image.png.tmp',
      'open:/data',
      'sync:/data',
      'close:/data',
    ])
  })

  it('copies exclusively when hard links are unsupported', async () => {
    control.linkError = Object.assign(new Error('operation not permitted'), { code: 'EPERM' })

    await commitFile({ temp: '/data/image.png.tmp', target: '/data/image.png', isExclusive: true })

    expect(calls).toEqual([
      'open:/data/image.png.tmp',
      'sync:/data/image.png.tmp',
      'close:/data/image.png.tmp',
      'copyFile:/data/image.png.tmp:/data/image.png:1',
      'unlink:/data/image.png.tmp',
      'open:/data',
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
