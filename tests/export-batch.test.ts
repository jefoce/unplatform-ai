import { randomUUID } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { rememberExportFolder } from '@/server/services/export-tokens'

import type { GenerationRecord } from '../src/core/schemas/generation-record'
import { required } from './helpers/required'

const root = await mkdtemp(path.join(os.tmpdir(), 'cf-export-batch-'))

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

const { POST } = await import('@/app/api/generations/export-batch/route')
const { copyUnique, exportDir } = await import('@/server/fs/export-files')

const downloads = path.join(root, 'downloads')
const videoBytes = Buffer.from('fake-mp4-bytes')

function record(id: string, prompt = 'A cat'): GenerationRecord {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'completed',
    provider: 'openrouter',
    input: {
      presetId: 'seedance-2.0',
      tab: 'references',
      prompt,
      audio: true,
      duration: 4,
      aspectRatio: '16:9',
      resolution: '1080p',
      frames: { start: null, end: null },
      references: [],
      seed: null,
    },
    preset: { id: 'seedance-2.0', title: 'Seedance', slug: 'seedance' },
    inputsSnapshot: {},
    seedUsed: 1,
    favorite: false,
    cost: {
      currency: 'USD',
      pricePerSec: 0,
      priceSource: 'mock',
      estimatedUsd: 0,
      actualUsd: 0,
      isByok: false,
      billed: true,
    },
    output: { video: `${id}.mp4` },
  }
}

async function write(item: GenerationRecord): Promise<void> {
  await writeFile(path.join(downloads, `${item.id}.json`), JSON.stringify(item))
  await writeFile(path.join(downloads, `${item.id}.mp4`), videoBytes)
}

const exportRequest = (body: unknown): Request => {
  return new Request('http://127.0.0.1:3000/api/generations/export-batch', {
    method: 'POST',
    headers: {
      host: '127.0.0.1:3000',
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
    },
    body: JSON.stringify(body),
  })
}

const item = record(randomUUID(), 'A cat!')

async function grantedDir(): Promise<string> {
  const dir = await mkdtemp(path.join(root, 'out-'))

  rememberExportFolder(dir, 1)

  return dir
}

beforeAll(async () => {
  await mkdir(downloads, { recursive: true })
  await write(item)
})

describe('POST /api/generations/export-batch', () => {
  beforeEach(() => {
    session.required = true
    session.desktop = true
  })

  it('copies videos into the folder', async () => {
    const dir = await grantedDir()
    const response = await POST(exportRequest({ ids: [item.id], dir }))
    const body = (await response.json()) as { saved: string[]; skipped: unknown[] }

    expect(response.status).toBe(200)
    expect(body.saved).toHaveLength(1)

    const saved = required(body.saved[0], 'saved file')

    expect(path.basename(saved)).toBe('seedance.mp4')
    expect(await readFile(saved)).toEqual(videoBytes)
    expect(body.skipped).toEqual([])
  })

  it('leaves no temp files in the export folder', async () => {
    const dir = await grantedDir()
    const saved = 'seedance.mp4'
    const leftover = `${saved}.tmp-00000000-0000-4000-8000-000000000000`
    const notes = path.join(dir, 'notes.txt')

    await writeFile(path.join(dir, leftover), 'stale')
    await writeFile(notes, 'keep')

    expect((await POST(exportRequest({ ids: [item.id], dir }))).status).toBe(200)

    const names = await readdir(dir)

    expect(names).not.toContain(leftover)
    expect(await readFile(notes, 'utf8')).toBe('keep')
  })

  it('adds -2 on a name collision and never overwrites', async () => {
    const dir = await grantedDir()
    const first = path.join(dir, 'seedance.mp4')

    await writeFile(first, 'keep')

    const response = await POST(exportRequest({ ids: [item.id], dir }))
    const body = (await response.json()) as { saved: string[] }

    const saved = required(body.saved[0], 'saved file')

    expect(path.basename(saved)).toBe('seedance-2.mp4')
    expect(await readFile(first, 'utf8')).toBe('keep')
    expect((await stat(saved)).isFile()).toBe(true)
  })

  it('accepts a symlinked target dir and writes to the real folder', async () => {
    const real = await mkdtemp(path.join(root, 'real-'))
    const link = path.join(root, `link-${randomUUID()}`)

    await symlink(real, link)
    rememberExportFolder(link, 1)

    const response = await POST(exportRequest({ ids: [item.id], dir: link }))
    const body = (await response.json()) as { saved: string[] }

    expect(response.status).toBe(200)
    expect(path.dirname(required(body.saved[0], 'saved file'))).toBe(await realpath(real))
  })

  it('rejects relative targets and missing records', async () => {
    const relative = await POST(exportRequest({ ids: [item.id], dir: 'downloads' }))

    expect(relative.status).toBe(400)

    const dir = await grantedDir()
    const missing = randomUUID()
    const response = await POST(exportRequest({ ids: [missing], dir }))
    const body = (await response.json()) as { skipped: { reason: string }[] }

    expect(body.skipped).toEqual([{ id: missing, reason: 'not_found' }])
  })

  it('403s without a folder grant', async () => {
    const dir = await mkdtemp(path.join(root, 'out-'))
    const response = await POST(exportRequest({ ids: [item.id], dir }))

    expect(response.status).toBe(403)
    expect(await readdir(dir)).toEqual([])
  })

  it('404s in browser mode', async () => {
    session.required = false
    const dir = await grantedDir()
    const response = await POST(exportRequest({ ids: [item.id], dir }))

    expect(response.status).toBe(404)
  })

  it('404s when the shell is not the desktop parent', async () => {
    session.desktop = false
    const dir = await grantedDir()
    const response = await POST(exportRequest({ ids: [item.id], dir }))

    expect(response.status).toBe(404)
  })
})

describe('copyUnique', () => {
  it('numbers three copies from one model', async () => {
    const dir = await grantedDir()
    const source = path.join(root, `source-${randomUUID()}.mp4`)

    await writeFile(source, videoBytes)

    const names: string[] = []

    for (let index = 0; index < 3; index += 1) {
      const saved = await copyUnique({ source, dir, base: 'seedance', ext: 'mp4' })

      names.push(path.basename(saved))
    }

    expect(names).toEqual(['seedance.mp4', 'seedance-2.mp4', 'seedance-3.mp4'])
  })
})

describe('exportDir', () => {
  let dirRoot = ''

  beforeAll(async () => {
    dirRoot = await mkdtemp(path.join(os.tmpdir(), 'cf-export-dir-'))
  })

  afterAll(async () => {
    await rm(dirRoot, { recursive: true, force: true })
  })

  it('returns the real path of an absolute directory', async () => {
    const dir = await mkdtemp(path.join(dirRoot, 'dir-'))

    expect(await exportDir(dir)).toBe(await realpath(dir))
  })

  describe.skipIf(process.platform === 'win32')('a symlink to a directory', () => {
    it('returns the real target, not the link path', async () => {
      const target = await mkdtemp(path.join(dirRoot, 'target-'))
      const link = path.join(dirRoot, `link-${randomUUID()}`)

      await symlink(target, link)

      expect(await exportDir(link)).toBe(await realpath(target))
    })
  })

  it('returns null for a regular file', async () => {
    const file = path.join(dirRoot, `file-${randomUUID()}`)

    await writeFile(file, 'bytes')

    expect(await exportDir(file)).toBeNull()
  })

  it('returns null for a relative path', async () => {
    expect(await exportDir('downloads')).toBeNull()
  })

  it('returns null for a missing path', async () => {
    expect(await exportDir(path.join(dirRoot, randomUUID()))).toBeNull()
  })
})
