import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { streamMultipartFiles } from '@/server/fs/multipart'

const dir = path.join(os.tmpdir(), `cf-multipart-${process.pid}-${Date.now()}`)

beforeAll(async () => {
  await fs.mkdir(dir, { recursive: true })
})

afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

const boundary = 'test-boundary'

function formRequest(files: { name: string; bytes: Buffer }[]): Request {
  const chunks: Buffer[] = []

  for (const file of files) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      file.bytes,
      Buffer.from('\r\n'),
    )
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`))

  return new Request('http://127.0.0.1:3000/api/uploads', {
    method: 'POST',
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat(chunks),
  })
}

describe('streamMultipartFiles', () => {
  it('writes each part to disk', async () => {
    const files = await streamMultipartFiles({
      request: formRequest([{ name: 'a.png', bytes: Buffer.from([1, 2, 3]) }]),
      dir,
      maxBytes: 1024,
    })

    expect(files).toHaveLength(1)

    const [file] = files

    expect(file?.name).toBe('a.png')
    expect(await fs.readFile(file?.path ?? '')).toEqual(Buffer.from([1, 2, 3]))
    await fs.rm(file?.path ?? '')
  })

  it('413s a part over the cap and removes partial files', async () => {
    await expect(
      streamMultipartFiles({
        request: formRequest([{ name: 'big.png', bytes: Buffer.alloc(2048) }]),
        dir,
        maxBytes: 1024,
      }),
    ).rejects.toMatchObject({ status: 413 })

    expect(await fs.readdir(dir)).toEqual([])
  })
})
