import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-thumbs-pending-'))

vi.stubEnv('STORAGE_ROOT', root)

state.sourcePath = path.join(root, 'source.png')
await fs.writeFile(state.sourcePath, 'not an image')

const { GET } = await import('@/app/api/thumbs/[...ref]/route')

const context = {
  params: Promise.resolve({ ref: ['images', 'source.png'] }),
}

function thumbRequest(): Request {
  return new Request('http://127.0.0.1:3000/api/thumbs/images/source.png?w=320', {
    headers: { host: '127.0.0.1:3000' },
  })
}

afterAll(async () => {
  vi.unstubAllEnvs()
  await fs.rm(root, { recursive: true, force: true })
})

describe('GET /api/thumbs/[...ref] while the thumb is not ready', () => {
  it('answers 503 with Retry-After, then succeeds on the retry', async () => {
    const pending = await GET(thumbRequest(), context)

    expect(pending.status).toBe(503)
    expect(pending.headers.get('retry-after')).toBe('1')
    expect(await pending.json()).toEqual({ error: 'Thumbnail not ready' })

    await fs.copyFile(FIXTURE_PNG, state.sourcePath)

    const retried = await GET(thumbRequest(), context)

    expect(retried.status).toBe(200)

    await retried.arrayBuffer()
  })
})
