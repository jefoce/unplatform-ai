import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => {
  return { sourcePath: '', thumbDir: '' }
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

vi.mock('@/server/media/thumbs', () => {
  return {
    getThumbnail: async (input: { mtimeMs: number }) => {
      const hash = `h${Math.floor(input.mtimeMs)}`

      return { filePath: `${state.thumbDir}/${hash}.webp`, contentType: 'image/webp' as const }
    },
  }
})

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'upai-thumbs-route-'))

state.sourcePath = path.join(root, 'source.png')
state.thumbDir = path.join(root, 'thumbs')

await fs.mkdir(state.thumbDir, { recursive: true })
await fs.writeFile(state.sourcePath, 'png')

const { GET } = await import('@/app/api/thumbs/[...ref]/route')

const context = {
  params: Promise.resolve({ ref: ['folders', 'demo', 'a.png'] }),
}

function thumbRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://127.0.0.1:3000/api/thumbs/folders/demo/a.png', {
    headers: { host: '127.0.0.1:3000', ...headers },
  })
}

/** Writes the thumb the mocked getThumbnail names after the source mtime. */
async function prepareThumb(mtimeMs: number): Promise<string> {
  await fs.utimes(state.sourcePath, new Date(mtimeMs), new Date(mtimeMs))

  const stats = await fs.stat(state.sourcePath)
  const hash = `h${Math.floor(stats.mtimeMs)}`

  await fs.writeFile(path.join(state.thumbDir, `${hash}.webp`), 'webp')

  return `"${hash}"`
}

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('GET /api/thumbs/[...ref]', () => {
  it('returns a strong ETag and a 304 for a matching If-None-Match', async () => {
    const etag = await prepareThumb(1_700_000_000_000)
    const response = await GET(thumbRequest(), context)

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe(etag)
    expect(response.headers.get('cache-control')).toBe('private, no-cache')
    expect(etag.startsWith('W/')).toBe(false)

    await response.arrayBuffer()

    const revalidated = await GET(thumbRequest({ 'if-none-match': etag }), context)

    expect(revalidated.status).toBe(304)
    expect(revalidated.headers.get('etag')).toBe(etag)
    expect(revalidated.headers.get('cache-control')).toBe('private, no-cache')
  })

  it('changes the ETag when the source mtime changes', async () => {
    const first = await prepareThumb(1_700_000_000_000)
    const second = await prepareThumb(1_700_000_100_000)

    expect(second).not.toBe(first)

    const response = await GET(thumbRequest({ 'if-none-match': first }), context)

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe(second)

    await response.arrayBuffer()
  })
})
