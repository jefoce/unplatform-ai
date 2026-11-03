import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { MAX_UPLOAD_FILES } from '@/core/constants'

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-upload-tmp-'))

process.env.STORAGE_ROOT = root

const tmpDir = path.join(root, 'tmp')
const boundary = 'cleanup-boundary'

vi.mock('@/server/session', () => {
  return {
    hasSession: () => {
      return true
    },
  }
})

const { POST } = await import('@/app/api/uploads/route')
const { cleanupStale } = await import('@/server/paths')

interface FormFile {
  name: string
  bytes: Buffer
}

function formRequest(files: FormFile[]): Request {
  const chunks: Buffer[] = []

  for (const file of files) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
      ),
      file.bytes,
      Buffer.from('\r\n'),
    )
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`))

  const body = Buffer.concat(chunks)

  return new Request('http://127.0.0.1:3000/api/uploads', {
    method: 'POST',
    headers: {
      host: '127.0.0.1:3000',
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'sec-fetch-site': 'same-origin',
    },
    body,
  })
}

beforeAll(async () => {
  await fs.mkdir(tmpDir, { recursive: true })
})

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('multipart temp cleanup', () => {
  it('leaves no temp file when the upload fails', async () => {
    const response = await POST(formRequest([{ name: 'notes.txt', bytes: Buffer.from('nope') }]))

    expect(response.status).toBe(400)
    expect(await fs.readdir(tmpDir)).toEqual([])
  })

  it('413s more files than the cap and leaves no temp files', async () => {
    const files = Array.from({ length: MAX_UPLOAD_FILES + 1 }, (_, index) => {
      return { name: `${String(index)}.png`, bytes: Buffer.from([1]) }
    })

    const response = await POST(formRequest(files))

    expect(response.status).toBe(413)
    expect(await fs.readdir(tmpDir)).toEqual([])
  })

  it('sweeps old temp files from the storage tmp dir', async () => {
    const old = path.join(tmpDir, `upload-${Date.now()}.tmp-`)
    const fresh = path.join(tmpDir, `upload-${Date.now()}-fresh.tmp-`)
    const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000)

    await fs.writeFile(old, 'old')
    await fs.writeFile(fresh, 'fresh')
    await fs.utimes(old, oldTime, oldTime)

    await cleanupStale()

    const names = await fs.readdir(tmpDir)

    expect(names).not.toContain(path.basename(old))
    expect(names).toContain(path.basename(fresh))
  })
})
