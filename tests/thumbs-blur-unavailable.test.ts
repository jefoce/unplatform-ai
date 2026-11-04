import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, describe, expect, it, vi } from 'vitest'

import type * as ThumbsModule from '@/server/media/thumbs'

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

vi.mock('@/server/media/thumbs', async (importOriginal) => {
  const actual = await importOriginal<typeof ThumbsModule>()

  return {
    ...actual,
    getThumbnail: async () => {
      throw new actual.ThumbUnavailableError()
    },
  }
})

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-thumbs-blur-unavailable-'))

vi.stubEnv('STORAGE_ROOT', root)

state.sourcePath = path.join(root, 'source.png')
await fs.writeFile(state.sourcePath, 'broken')

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

describe('GET /api/thumbs with blur when the source thumb is unavailable', () => {
  it('answers 404 instead of a retryable 503', async () => {
    const response = await GET(blurRequest(), context)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Thumbnail unavailable' })
  })
})
