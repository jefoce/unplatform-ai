import 'server-only'

import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

/** Returns null for missing or unparseable files, never throws. */
export async function readJson<T>(file: string): Promise<T | null> {
  try {
    const text = await fs.readFile(file, 'utf8')

    return JSON.parse(text) as T
  } catch {
    return null
  }
}

interface WriteJsonAtomicParams {
  file: string
  data: unknown
  opts?: { mode?: number }
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
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

export async function listJsonFileNames(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .filter((entry) => !entry.name.includes('.tmp-'))
    .map((entry) => entry.name)
}
