import fs from 'node:fs/promises'
import path from 'node:path'
import { crc32 } from 'node:zlib'

import { isNil } from 'lodash-es'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as Uploads from '@/server/repos/uploads'
import type { createLinkUpload as CreateLinkUpload } from '@/server/services/uploads'

import { MAX_IMAGE_PIXELS } from '../src/core/constants'
import { required } from './helpers/required'

vi.mock('server-only', () => {
  return {}
})

const ROOT = path.join(process.cwd(), '.cache', `link-mode-test-${process.pid}`)
const UPLOADS = path.join(ROOT, 'uploads')
const SOURCE = path.join(ROOT, 'source.png')
const BYTES = 'not really a png'
const PREVIOUS_ROOT = process.env.STORAGE_ROOT
const PNG_FIXTURE = path.join(process.cwd(), 'tests', 'fixtures', 'media', 'sample.png')

process.env.STORAGE_ROOT = ROOT

let uploads: typeof Uploads
let createLinkUpload: typeof CreateLinkUpload

beforeAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  uploads = await import('@/server/repos/uploads')

  const services = await import('@/server/services/uploads')

  createLinkUpload = services.createLinkUpload
})

beforeEach(async () => {
  await fs.rm(UPLOADS, { recursive: true, force: true })
  await fs.mkdir(UPLOADS, { recursive: true })
  await fs.writeFile(SOURCE, BYTES)
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (isNil(PREVIOUS_ROOT)) {
    delete process.env.STORAGE_ROOT
  } else {
    process.env.STORAGE_ROOT = PREVIOUS_ROOT
  }
})

function errno(code: string): Error {
  return Object.assign(new Error(code), { code })
}

/**
 * Rewrites a real png header to 60 MP.
 * The bytes stay tiny, so no large binary is committed.
 */
async function writeOversizedPng(file: string): Promise<void> {
  const bytes = Buffer.from(await fs.readFile(PNG_FIXTURE))

  bytes.writeUInt32BE(10_000, 16)
  bytes.writeUInt32BE(6_000, 20)
  bytes.writeUInt32BE(crc32(bytes.subarray(12, 29)) >>> 0, 29)

  await fs.writeFile(file, bytes)
}

describe('link upload fallback', () => {
  it('hard links when symlinks are denied', async () => {
    vi.spyOn(fs, 'symlink').mockRejectedValue(errno('EPERM'))

    const item = await createLinkUpload({ absPath: SOURCE })

    expect(item.linkMode).toBe('hardlink')

    await fs.rm(SOURCE)
    const listed = required((await uploads.listUploads({ ids: [item.id] }))[0], 'listed upload')

    expect(listed.missing).toBe(false)
  })

  it('copies bytes when symlinks and hard links both fail', async () => {
    vi.spyOn(fs, 'symlink').mockRejectedValue(errno('EPERM'))
    vi.spyOn(fs, 'link').mockRejectedValue(errno('EXDEV'))

    const item = await createLinkUpload({ absPath: SOURCE })

    expect(item.linkMode).toBe('copy')

    await fs.rm(SOURCE)
    const listed = required((await uploads.listUploads({ ids: [item.id] }))[0], 'listed upload')

    expect(listed.missing).toBe(false)
    expect(await fs.readFile(path.join(UPLOADS, `${item.id}.png`), 'utf8')).toBe(BYTES)
  })

  it.skipIf(process.platform === 'win32')('marks a broken symlink missing', async () => {
    const item = await createLinkUpload({ absPath: SOURCE })

    expect(item.linkMode).toBe('symlink')

    await fs.rm(SOURCE)
    const listed = required((await uploads.listUploads({ ids: [item.id] }))[0], 'listed upload')

    expect(listed.missing).toBe(true)
  })
})

describe('link upload probe', () => {
  it('removes the linked file when the probe rejects it', async () => {
    const source = path.join(ROOT, 'oversized.png')

    await writeOversizedPng(source)
    const before = await fs.readdir(UPLOADS)

    await expect(createLinkUpload({ absPath: source })).rejects.toThrow(
      `Image is too large (max ${MAX_IMAGE_PIXELS} pixels)`,
    )

    expect(await fs.readdir(UPLOADS)).toEqual(before)
  })

  it('keeps the linked file and its record', async () => {
    await fs.copyFile(PNG_FIXTURE, SOURCE)

    const item = await createLinkUpload({ absPath: SOURCE })
    const listed = required((await uploads.listUploads({ ids: [item.id] }))[0], 'listed upload')

    expect(listed.missing).toBe(false)
    expect(listed.width).toBe(64)

    expect(await fs.readdir(UPLOADS)).toEqual(
      expect.arrayContaining([`${item.id}.json`, `${item.id}.png`]),
    )
  })
})
