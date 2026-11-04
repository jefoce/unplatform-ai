/* eslint-disable max-lines-per-function -- the export route cases stay in one suite */

import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, stat, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  consumeExportPath,
  rememberExportFolder,
  rememberExportPath,
} from '@/server/services/export-tokens'

import { storedRecord } from './helpers/stored-record'

const root = await mkdtemp(path.join(os.tmpdir(), 'cf-export-'))

process.env.STORAGE_ROOT = root
delete process.env.APP_TOKEN

const session = vi.hoisted(() => {
  return { required: true, desktop: true }
})

vi.mock('@/server/session', () => {
  return {
    desktopMode: () => {
      return session.required
    },
    isDesktopMode: () => {
      return session.desktop
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
    session.desktop = true
  })

  it('rejects relative paths', async () => {
    const response = await POST(exportRequest({ path: 'video.mp4' }), context())

    expect(response.status).toBe(400)
  })

  it('rejects non-mp4 targets', async () => {
    const response = await POST(exportRequest({ path: path.join(root, 'video.avi') }), context())

    expect(response.status).toBe(400)
  })

  it('writes a unique name from a folder grant', async () => {
    const target = path.join(root, 'existing.mp4')

    await writeFile(target, 'keep')
    rememberExportFolder(root, 1)
    const response = await POST(exportRequest({ path: target }), context())
    const body = (await response.json()) as { path: string }

    expect(response.status).toBe(201)
    expect(await readFile(target, 'utf8')).toBe('keep')
    expect(body.path).toBe(path.join(root, 'existing (2).mp4'))
  })

  it('copies the video to the target', async () => {
    const target = path.join(root, 'copy.mp4')

    rememberExportPath(target)
    const response = await POST(exportRequest({ path: target }), context())

    expect(response.status).toBe(201)
    expect((await stat(target)).size).toBe(videoBytes.length)
    expect(await readFile(target)).toEqual(videoBytes)
  })

  it('leaves no temp file next to the export', async () => {
    const target = path.join(root, 'atomic.mp4')

    rememberExportPath(target)
    await POST(exportRequest({ path: target }), context())

    const names = await readdir(root)

    expect(
      names.filter((name) => {
        return name.includes('.tmp-')
      }),
    ).toEqual([])
  })

  it('overwrites only a path the dialog registered, once', async () => {
    const target = path.join(root, 'copy.mp4')

    await writeFile(target, 'old')
    rememberExportPath(target)

    const response = await POST(exportRequest({ path: target }), context())

    expect(response.status).toBe(201)
    expect(await readFile(target)).toEqual(videoBytes)
    expect(consumeExportPath(target)).toBe(false)

    await writeFile(target, 'old again')
    const next = await POST(exportRequest({ path: target }), context())

    expect(next.status).toBe(403)
    expect(await readFile(target, 'utf8')).toBe('old again')
  })

  it('403s without a dialog token', async () => {
    const target = path.join(root, 'no-token.mp4')
    const response = await POST(exportRequest({ path: target }), context())

    expect(response.status).toBe(403)
    await expect(stat(target)).rejects.toThrow()
  })

  it('404s in browser mode', async () => {
    session.required = false
    const target = path.join(root, 'browser.mp4')
    const response = await POST(exportRequest({ path: target }), context())

    expect(response.status).toBe(404)
  })

  it('404s when the shell is not the desktop parent', async () => {
    session.desktop = false
    const target = path.join(root, 'no-desktop.mp4')

    rememberExportPath(target)
    const response = await POST(exportRequest({ path: target }), context())

    expect(response.status).toBe(404)
  })

  it('rejects a symlink target and leaves its file alone', async () => {
    const real = path.join(root, 'real-target.mp4')

    await writeFile(real, 'keep')
    const link = path.join(root, 'link.mp4')

    await symlink(real, link)
    const response = await POST(exportRequest({ path: link }), context())

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
