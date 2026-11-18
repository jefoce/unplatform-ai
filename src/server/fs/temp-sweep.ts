import 'server-only'

import fs from 'node:fs/promises'
import path from 'node:path'

import {
  COMPAT_DIR,
  DATA_DIR,
  DOWNLOADS_DIR,
  IMAGES_DIR,
  isTempName,
  STORAGE_TMP_DIR,
  THUMBS_DIR,
  UPLOADS_DIR,
} from '../paths'

const OWNED_DIRS = [
  DOWNLOADS_DIR,
  IMAGES_DIR,
  UPLOADS_DIR,
  STORAGE_TMP_DIR,
  DATA_DIR,
  path.join(DATA_DIR, 'endpoint-models'),
  THUMBS_DIR,
  COMPAT_DIR,
]

/** Deletes files a killed write left behind. Runs once at boot, before any job starts. */
export async function sweepInterruptedTemps(): Promise<number> {
  let removed = 0

  for (const dir of OWNED_DIRS) {
    removed += await removeTemps(dir)
  }

  return removed
}

async function removeTemps(dir: string): Promise<number> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => {
    return []
  })

  let removed = 0

  for (const entry of entries) {
    if (!entry.isFile() || !isTempName(entry.name)) {
      continue
    }

    const file = path.join(dir, entry.name)

    try {
      const stats = await fs.lstat(file)

      if (!stats.isFile()) {
        continue
      }

      await fs.unlink(file)
      removed += 1
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`[unplatform-ai] temp cleanup failed for ${entry.name}`, error)
      }
    }
  }

  return removed
}
