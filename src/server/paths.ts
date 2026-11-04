import 'server-only'

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { UPLOAD_CLEANUP_MS } from '@/core/constants'
import { isNonEmptyString } from '@/core/guards'

const envRoot = process.env.STORAGE_ROOT?.trim()
const defaultRoot = path.join(os.homedir(), '.unplatform-ai')

/** Same root for browser and desktop. STORAGE_ROOT overrides it (tests, custom setups). */
export const STORAGE_ROOT = storageRoot()

function storageRoot(): string {
  if (!isNonEmptyString(envRoot)) {
    return defaultRoot
  }

  return path.resolve(envRoot)
}

const LOGS_DIR = path.join(STORAGE_ROOT, 'logs')

export const LOCK_FILE = path.join(STORAGE_ROOT, 'server.lock')
export const DOWNLOADS_DIR = path.join(STORAGE_ROOT, 'downloads')
export const IMAGES_DIR = path.join(STORAGE_ROOT, 'images')
export const UPLOADS_DIR = path.join(STORAGE_ROOT, 'uploads')

/** Scratch files for uploads and probes. Never served. */
export const STORAGE_TMP_DIR = path.join(STORAGE_ROOT, 'tmp')
const DATA_DIR = path.join(STORAGE_ROOT, 'data')

export const THUMBS_DIR = path.join(STORAGE_ROOT, '.cache', 'thumbs')
export const COMPAT_DIR = path.join(STORAGE_ROOT, '.cache', 'compat')
export const FOLDERS_FILE = path.join(DATA_DIR, 'folders.json')

export interface DownloadPaths {
  json: string
  video: string
  preview: string
  part: string
}

export interface UploadPaths {
  media: string
  json: string
}

export async function ensureDirs(): Promise<void> {
  await fs.mkdir(STORAGE_ROOT, { recursive: true, mode: 0o700 })
  await fs.chmod(STORAGE_ROOT, 0o700)

  await Promise.all(
    [
      DOWNLOADS_DIR,
      IMAGES_DIR,
      UPLOADS_DIR,
      DATA_DIR,
      THUMBS_DIR,
      COMPAT_DIR,
      LOGS_DIR,
      STORAGE_TMP_DIR,
    ].map(async (dir) => {
      await fs.mkdir(dir, { recursive: true, mode: 0o700 })
      await fs.chmod(dir, 0o700)
    }),
  )
}

export function downloadPaths(id: string): DownloadPaths {
  const base = path.join(DOWNLOADS_DIR, id)

  return {
    json: `${base}.json`,
    video: `${base}.mp4`,
    preview: `${base}.preview.webp`,
    part: `${base}.mp4.part`,
  }
}

export function uploadPaths(id: string, ext: string): UploadPaths {
  const base = path.join(UPLOADS_DIR, id)

  return { media: `${base}${ext}`, json: `${base}.json` }
}

export function imageRecordPath(id: string): string {
  return path.join(IMAGES_DIR, `${id}.json`)
}

interface ImageFileParams {
  id: string
  index: number
  ext: string
}

export function imageOutputPath(params: ImageFileParams): string {
  const { id, index, ext } = params

  return path.join(IMAGES_DIR, `${id}-${index}${ext}`)
}

export function imageTempPath(params: ImageFileParams): string {
  const { id, index, ext } = params

  return path.join(IMAGES_DIR, `${id}-${index}.tmp-${ext}`)
}

interface CleanupResult {
  removed: number
}

/** Deletes stale `*.part` and `*.tmp-*` files. Skips symlinks. */
export async function cleanupStale(): Promise<CleanupResult> {
  const cutoff = Date.now() - UPLOAD_CLEANUP_MS

  const [downloads, images, uploads, temps] = await Promise.all([
    removeStale(DOWNLOADS_DIR, cutoff),
    removeStale(IMAGES_DIR, cutoff),
    removeStale(UPLOADS_DIR, cutoff),
    removeStale(STORAGE_TMP_DIR, cutoff),
  ])

  return { removed: downloads + images + uploads + temps }
}

async function removeStale(dir: string, cutoff: number): Promise<number> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => {
    return []
  })

  let removed = 0

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }

    if (!entry.name.endsWith('.part') && !entry.name.includes('.tmp-')) {
      continue
    }

    const file = path.join(dir, entry.name)

    try {
      const stats = await fs.lstat(file)

      if (stats.mtimeMs >= cutoff) {
        continue
      }

      await fs.unlink(file)
      removed += 1
    } catch {
      // File vanished between readdir and unlink.
    }
  }

  return removed
}
