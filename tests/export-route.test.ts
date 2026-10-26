import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readFile, stat, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { storedRecord } from './helpers/stored-record'

const root = await mkdtemp(path.join(os.tmpdir(), 'upai-export-'))

process.env.STORAGE_ROOT = root
delete process.env.APP_TOKEN

const session = vi.hoisted(() => {
  return { required: true }
})

vi.mock('@/server/session', () => {
  return {
    sessionRequired: () => {
      return session.required
    },
    hasSession: () => {
      return true
    },
  }
})

const { POST } = await import('@/app/api/generations/[id]/export/route')

const id = randomUUID()
const videoBytes = Buffer.from('fake-mp4-bytes')

const exportRequest = (body: unknown, recordId = id): Request => {
  return new Request(`http://127.0.0.1:3000/api/generations/${recordId}/export`, {
    method: 'POST',
    headers: {
      host: '127.0.0.1:3000',
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
    },
    body: JSON.stringify(body),
  })
}

const context = (recordId = id) => {
  return { params: Promise.resolve({ id: recordId }) }
}

beforeAll(async () => {
  await mkdir(path.join(root, 'downloads'), { recursive: true })
  await writeFile(path.join(root, 'downloads', `${id}.json`), JSON.stringify(storedRecord(id)))
  await writeFile(path.join(root, 'downloads', `${id}.mp4`), videoBytes)
})

describe('POST /api/generations/[id]/export', () => {
  beforeEach(() => {
    session.required = true
  })

  it('rejects relative paths', async () => {
    const response = await POST(exportRequest({ path: 'video.mp4' }), context())

    expect(response.status).toBe(400)
  })

  it('rejects non-mp4 targets', async () => {
    const response = await POST(exportRequest({ path: path.join(root, 'video.avi') }), context())

    expect(response.status).toBe(400)
  })

  it('refuses to overwrite without the flag', async () => {
    const target = path.join(root, 'existing.mp4')

    await writeFile(target, 'keep')
    const response = await POST(exportRequest({ path: target }), context())

    expect(response.status).toBe(409)
    expect(await readFile(target, 'utf8')).toBe('keep')
  })

  it('copies the video to the target', async () => {
    const target = path.join(root, 'copy.mp4')
    const response = await POST(exportRequest({ path: target }), context())

    expect(response.status).toBe(201)
    expect((await stat(target)).size).toBe(videoBytes.length)
    expect(await readFile(target)).toEqual(videoBytes)
  })

  it('overwrites when asked', async () => {
    const target = path.join(root, 'copy.mp4')

    await writeFile(target, 'old')
    const response = await POST(exportRequest({ path: target, overwrite: true }), context())

    expect(response.status).toBe(201)
    expect(await readFile(target)).toEqual(videoBytes)
  })

  it('404s in browser mode', async () => {
    session.required = false
    const target = path.join(root, 'browser.mp4')
    const response = await POST(exportRequest({ path: target }), context())

    expect(response.status).toBe(404)
  })

  it('rejects a symlink target and leaves its file alone', async () => {
    const real = path.join(root, 'real-target.mp4')

    await writeFile(real, 'keep')
    const link = path.join(root, 'link.mp4')

    await symlink(real, link)
    const response = await POST(exportRequest({ path: link, overwrite: true }), context())

    expect(response.status).toBe(400)
    expect(await readFile(real, 'utf8')).toBe('keep')
  })

  it('404s for a missing generation', async () => {
    const missing = randomUUID()

    const response = await POST(
      exportRequest({ path: path.join(root, 'none.mp4') }, missing),
      context(missing),
    )

    expect(response.status).toBe(404)
  })
})
