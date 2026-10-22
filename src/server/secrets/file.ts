import 'server-only'

import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil, isString } from 'lodash-es'

import { SECRET_NAMES, SECRET_SCHEMAS, type SecretName } from '@/core/secret-names'

import { readJson, writeJsonAtomic } from '../fs/json-file'
import { STORAGE_ROOT } from '../paths'
import type { SecretBackend } from './index'

const FILE = path.join(STORAGE_ROOT, 'secrets.json')

type Values = Partial<Record<SecretName, string>>

/** 0600 JSON fallback used when no OS keychain is available. */
export function fileBackend(): SecretBackend {
  return {
    kind: 'file' as const,
    getAll: readAll,
    get: async (name: SecretName): Promise<string | null> => (await readAll())[name] ?? null,
    set: async (name: SecretName, value: string): Promise<void> => {
      const values = await readAll()

      values[name] = value
      await writeAll(values)
    },
    remove: async (name: SecretName): Promise<void> => {
      const values = await readAll()

      if (isNil(values[name])) return

      delete values[name]
      await writeAll(values)
    },
  }
}

/** Missing or group/other-readable files are treated as empty. */
async function readAll(): Promise<Values> {
  const stats = await fs.stat(FILE).catch(() => null)

  if (!stats) return {}

  if (process.platform !== 'win32' && (stats.mode & 0o077) !== 0) {
    console.warn('[unplatform-ai] secrets file is readable by others, ignoring it')

    return {}
  }

  const raw = await readJson<Record<string, unknown>>(FILE)

  if (!raw) return {}

  const values: Values = {}

  for (const name of SECRET_NAMES) {
    const value = raw[name]

    if (!isString(value)) continue

    const parsed = SECRET_SCHEMAS[name].safeParse(value)

    if (parsed.success) values[name] = parsed.data
  }

  return values
}

async function writeAll(values: Values): Promise<void> {
  await writeJsonAtomic({ file: FILE, data: values, opts: { mode: 0o600 } })
}
