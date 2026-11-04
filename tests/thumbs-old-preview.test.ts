import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, describe, expect, it, vi } from 'vitest'

const FIXTURE_PNG = fileURLToPath(new URL('./fixtures/media/sample.png', import.meta.url))

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-thumbs-old-preview-'))

vi.stubEnv('STORAGE_ROOT', root)

vi.mock('@/server/session', () => {
  return {
    hasSession: () => {
      return true
    },
  }
})

const downloads = path.join(root, 'downloads')
const oldPreview = 'old-record.preview.png'

await fs.mkdir(downloads, { recursive: true })
await fs.copyFile(FIXTURE_PNG, path.join(downloads, oldPreview))

const { GET } = await import('@/app/api/thumbs/[...ref]/route')

const context = {
  params: Promise.resolve({ ref: ['downloads', oldPreview] }),
}

function thumbRequest(): Request {
  return new Request(`http://127.0.0.1:3000/api/thumbs/downloads/${oldPreview}?w=320`, {
    headers: { host: '127.0.0.1:3000' },
  })
}

afterAll(async () => {
  vi.unstubAllEnvs()
  await fs.rm(root, { recursive: true, force: true })
})

describe('GET /api/thumbs for an old record preview', () => {
  it('serves the thumb of a record whose output.preview is still a .png name', async () => {
    const response = await GET(thumbRequest(), context)
    const bytes = new Uint8Array(await response.arrayBuffer())
    const header = Buffer.from(bytes).subarray(0, 12).toString('latin1')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/webp')
    expect(bytes.byteLength).toBeGreaterThan(0)
    expect(header.startsWith('RIFF')).toBe(true)
    expect(header.endsWith('WEBP')).toBe(true)
  })
})
