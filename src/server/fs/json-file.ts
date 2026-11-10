import 'server-only'

import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import type { ZodType } from 'zod'

import { globalState } from '../global-state'
import { STORAGE_ROOT } from '../paths'
import { commitFile, retryOnWindowsLock } from './atomic-file'
import { isInside } from './safe-path'

const READ_RETRY_DELAYS = [25]

/** A save may briefly remove or lock the record file on Windows. */
const READ_RETRY_CODES = new Set(['ENOENT', 'EPERM'])

const warnings = globalState<Set<string>>('jsonWarnings', () => {
  return new Set()
})

const UUID_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.-]/i
const HASH_NAME = /^[0-9a-f]{16,}\./

/** Logs once per file path and mtime, so a bad file does not warn on every reload. */
async function warnInvalid(file: string, message: string): Promise<void> {
  const mtimeMs = await fs.stat(file).then(
    (stats) => {
      return stats.mtimeMs
    },
    () => {
      return 0
    },
  )

  const key = `${file}:${mtimeMs}`

  if (warnings.has(key)) {
    return
  }

  warnings.add(key)
  console.warn(message)
}

/** Returns null for missing or invalid files, never throws. */
export async function readJson<T>(file: string, schema: ZodType<T>): Promise<T | null> {
  let text: string

  try {
    text = await retryOnWindowsLock(
      () => {
        return fs.readFile(file, 'utf8')
      },
      { codes: READ_RETRY_CODES, delays: READ_RETRY_DELAYS },
    )
  } catch {
    return null
  }

  let raw: unknown

  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }

  const parsed = schema.safeParse(raw)

  if (parsed.success) {
    return parsed.data
  }

  const first = parsed.error.issues[0]

  await warnInvalid(
    file,
    `[unplatform-ai] skipping invalid json ${file}: ${first?.message ?? 'invalid'}`,
  )

  return null
}

/** Missing returns null. A present file that cannot be read or parsed throws. */
export async function readJsonStrict<T>(file: string, schema: ZodType<T>): Promise<T | null> {
  const isMissing = await fs.stat(file).then(
    () => {
      return false
    },
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        return true
      }

      throw error
    },
  )

  if (isMissing) {
    return null
  }

  const value = await readJson(file, schema)

  if (isNil(value)) {
    throw new Error(`Unreadable json: ${file}`)
  }

  return value
}

interface WriteJsonAtomicOptions {
  mode?: number
}

interface WriteJsonAtomicParams {
  file: string
  data: unknown
  opts?: WriteJsonAtomicOptions
}

export async function writeJsonAtomic(params: WriteJsonAtomicParams): Promise<void> {
  const { file, data, opts = {} } = params

  await fs.mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.tmp-${randomUUID()}`
  const mode = opts.mode ?? 0o644

  await fs.writeFile(temp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode })
  await commitFile({ temp, target: file })
}

export async function removeFile(file: string): Promise<void> {
  try {
    await retryOnWindowsLock(() => {
      return fs.unlink(file)
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}

/** True when the basename matches a name the app writes: a UUID or a content hash. */
export function isOwnedName(name: string): boolean {
  const base = path.basename(name)

  return UUID_NAME.test(base) || HASH_NAME.test(base)
}

/** Deletes an app-owned file inside STORAGE_ROOT. Missing counts as success. */
export async function removeOwnedFile(file: string): Promise<void> {
  const root = path.resolve(STORAGE_ROOT)
  const resolved = path.resolve(root, file)

  if (resolved === root || !isInside(root, resolved)) {
    throw new Error('Refusing to delete outside storage')
  }

  if (!isOwnedName(resolved)) {
    throw new Error('Refusing to delete a file the app does not own')
  }

  await removeFile(resolved)
}

export async function listJsonFileNames(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => {
    return []
  })

  return entries
    .filter((entry) => {
      return entry.isFile() && entry.name.endsWith('.json')
    })
    .filter((entry) => {
      return !entry.name.includes('.tmp-')
    })
    .map((entry) => {
      return entry.name
    })
}
