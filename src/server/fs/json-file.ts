import 'server-only'

import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import type { ZodType } from 'zod'

import { globalState } from '../global-state'

const warnings = globalState<Set<string>>('jsonWarnings', () => {
  return new Set()
})

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
    text = await fs.readFile(file, 'utf8')
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
  await fs.rename(temp, file)
}

export async function removeFile(file: string): Promise<void> {
  try {
    await fs.unlink(file)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
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
