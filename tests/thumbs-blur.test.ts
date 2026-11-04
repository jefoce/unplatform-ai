import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'
import { afterAll, describe, expect, it, vi } from 'vitest'

const FIXTURE_PNG = fileURLToPath(new URL('./fixtures/media/sample.png', import.meta.url))

const state = vi.hoisted(() => {
  return { sourcePath: '' }
})

vi.mock('@/server/session', () => {
  return {
    hasSession: () => {
      return true
    },
  }
})

vi.mock('@/server/fs/media-ref', () => {
  return {
    resolveMediaRef: async (ref: string[]) => {
      return { absolutePath: state.sourcePath, kind: 'image' as const, ref: ref.join('/') }
    },
  }
})

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-thumbs-blur-'))

vi.stubEnv('STORAGE_ROOT', root)

state.sourcePath = path.join(root, 'source.png')
await fs.copyFile(FIXTURE_PNG, state.sourcePath)

const { GET } = await import('@/app/api/thumbs/[...ref]/route')

const context = {
  params: Promise.resolve({ ref: ['images', 'source.png'] }),
}

function blurRequest(): Request {
  return new Request('http://127.0.0.1:3000/api/thumbs/images/source.png?blur=1', {
    headers: { host: '127.0.0.1:3000' },
  })
}

afterAll(async () => {
  vi.unstubAllEnvs()
  await fs.rm(root, { recursive: true, force: true })
})

describe('GET /api/thumbs with blur', () => {
  it('answers a 96 px wide WebP', async () => {
    const response = await GET(blurRequest(), context)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/webp')

    const buffer = Buffer.from(await response.arrayBuffer())
    const metadata = await sharp(buffer).metadata()

    expect(metadata.format).toBe('webp')
    expect(metadata.width).toBe(96)
  })

  it('answers 404 when the source is gone', async () => {
    const source = state.sourcePath

    state.sourcePath = path.join(root, 'missing.png')

    const response = await GET(blurRequest(), context)

    state.sourcePath = source

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'File not found' })
  })
})

describe('blur cache key', () => {
  it('is stable per source and separate from every thumb width', async () => {
    const { blurCacheKey } = await import('../src/server/media/blur-thumb')
    const { thumbCacheKey } = await import('../src/server/media/thumbs')
    const params = { ref: 'images/source.png', mtimeMs: 1_700_000_000_000 }

    expect(blurCacheKey(params)).toBe(blurCacheKey(params))
    expect(blurCacheKey({ ...params, ref: 'images/other.png' })).not.toBe(blurCacheKey(params))
    expect(blurCacheKey({ ...params, mtimeMs: params.mtimeMs + 1 })).not.toBe(blurCacheKey(params))

    for (const width of [320, 640, 960]) {
      expect(blurCacheKey(params)).not.toBe(thumbCacheKey({ ...params, width }))
    }
  })
})
