import type * as NodeFs from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const root = path.join(os.tmpdir(), `cf-range-stream-${process.pid}-${Date.now()}`)
const absPath = path.join(root, 'clip.mp4')
const bytes = Uint8Array.from([1, 2, 3, 4, 5, 6])

const state = vi.hoisted(() => {
  return { streams: [] as NodeFs.ReadStream[] }
})

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeFs>()

  return {
    ...actual,
    createReadStream: (file: string, options?: { start?: number; end?: number }) => {
      const stream = actual.createReadStream(file, options)

      state.streams.push(stream)

      return stream
    },
  }
})

const { streamFile } = await import('@/server/fs/range-response')

beforeEach(async () => {
  state.streams.length = 0
  await fs.mkdir(root, { recursive: true })
  await fs.writeFile(absPath, bytes)
})

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('streamFile body', () => {
  it('serves a complete response', async () => {
    const response = await streamFile({
      absPath,
      request: new Request('http://127.0.0.1:3000/api/media/clip.mp4'),
    })

    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
  })

  it('destroys the read stream when the body is cancelled', async () => {
    const response = await streamFile({
      absPath,
      request: new Request('http://127.0.0.1:3000/api/media/clip.mp4'),
    })

    await response.body?.cancel()

    expect(state.streams[0]?.destroyed).toBe(true)
  })

  it('destroys the read stream when the request aborts', async () => {
    const controller = new AbortController()

    const response = await streamFile({
      absPath,
      request: new Request('http://127.0.0.1:3000/api/media/clip.mp4', {
        signal: controller.signal,
      }),
    })

    controller.abort()

    expect(response.body).not.toBeNull()
    expect(state.streams[0]?.destroyed).toBe(true)
  })
})
