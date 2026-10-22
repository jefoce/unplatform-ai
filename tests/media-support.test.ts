import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mediaUrl } from '@/features/media-picker/api'
import { __resetCanPlayCache, canPlay } from '@/lib/media-support'

function stubDocument(supported: Record<string, string>): void {
  vi.stubGlobal('document', {
    createElement: () => ({ canPlayType: (mime: string) => supported[mime] ?? '' }),
  })
  __resetCanPlayCache()
}

afterEach(() => {
  vi.unstubAllGlobals()
  __resetCanPlayCache()
})

describe('canPlay', () => {
  it('assumes support during SSR', () => {
    vi.stubGlobal('document', undefined)
    __resetCanPlayCache()
    expect(canPlay('video/webm')).toBe(true)
  })

  it('caches support per MIME type', () => {
    const createElement = vi.fn(() => ({
      canPlayType: (mime: string) => (mime === 'video/mp4' ? 'probably' : ''),
    }))

    vi.stubGlobal('document', { createElement })
    __resetCanPlayCache()

    expect(canPlay('video/webm')).toBe(false)
    expect(canPlay('video/webm')).toBe(false)
    expect(canPlay('video/mp4')).toBe(true)
    expect(createElement).toHaveBeenCalledTimes(2)
    expect(createElement).toHaveBeenCalledWith('video')
  })
})

describe('mediaUrl', () => {
  it('adds compat only for unsupported kinds', () => {
    stubDocument({ 'video/mp4': 'probably' })

    expect(mediaUrl('uploads/abc', 'video/webm')).toBe('/api/media/uploads/abc?compat=1')
    expect(mediaUrl('uploads/abc', 'video/mp4')).toBe('/api/media/uploads/abc')
    expect(mediaUrl('uploads/abc')).toBe('/api/media/uploads/abc')
  })

  it('keeps existing query params', () => {
    stubDocument({})

    expect(mediaUrl('uploads/abc?download=1&x=2', 'audio/ogg')).toBe(
      '/api/media/uploads/abc?download=1&x=2&compat=1',
    )
  })
})

describe('getCompatMedia', () => {
  let root = ''

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'upai-compat-'))
    vi.stubEnv('STORAGE_ROOT', root)
    vi.resetModules()
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    vi.resetModules()
    await fs.rm(root, { recursive: true, force: true })
  })

  it('reuses a fresh copy named by the ref hash', async () => {
    const { getCompatMedia } = await import('@/server/media/compat')
    const { COMPAT_DIR } = await import('@/server/paths')
    const source = path.join(root, 'source.webm')

    await fs.writeFile(source, 'source')

    const ref = 'uploads/id'
    const key = createHash('sha1').update(ref).digest('hex')
    const target = path.join(COMPAT_DIR, `${key}.mp4`)

    await fs.mkdir(COMPAT_DIR, { recursive: true })
    await fs.writeFile(target, 'compat')
    const future = new Date(Date.now() + 60_000)

    await fs.utimes(target, future, future)

    await expect(getCompatMedia({ absPath: source, kind: 'video', ref })).resolves.toEqual({
      path: target,
      contentType: 'video/mp4',
    })
  })

  it('throws when the source is missing', async () => {
    const { getCompatMedia } = await import('@/server/media/compat')

    await expect(
      getCompatMedia({ absPath: path.join(root, 'missing.webm'), kind: 'audio', ref: 'uploads/x' }),
    ).rejects.toThrow('Compat source missing')
  })
})
