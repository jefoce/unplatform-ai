import 'server-only'

import type { Entry } from '@napi-rs/keyring'
import { isNil, isString } from 'lodash-es'

import { isNonEmptyString, isRecord } from '@/core/guards'
import { SECRET_NAMES, type SecretName } from '@/core/secret-names'

import type { SecretBackend } from './types'

const SERVICE = 'unplatform-ai'

/** One keychain item holds every key as a JSON object. */
const ACCOUNT = 'secrets'

type Values = Partial<Record<SecretName, string>>

type EntryCtor = typeof Entry

/** Keychain backend with one shared item, or null when the module is missing. */
export async function keychainBackend(): Promise<SecretBackend | null> {
  let Entry: EntryCtor

  try {
    // Loaded lazily so the desktop sidecar never pulls the native keychain module.
    Entry = (await import('@napi-rs/keyring')).Entry
  } catch {
    return null
  }

  return {
    kind: 'keychain' as const,
    getAll: async () => {
      return readAll(Entry)
    },
    get: async (name: SecretName) => {
      return readAll(Entry)[name] ?? null
    },
    set: async (name: SecretName, value: string) => {
      const values = readAll(Entry)

      values[name] = value
      writeAll(Entry, values)
    },
    remove: async (name: SecretName) => {
      const values = readAll(Entry)

      if (isNil(values[name])) {
        return
      }

      delete values[name]
      writeAll(Entry, values)
    },
  }
}

function readAll(Entry: EntryCtor): Values {
  const raw = new Entry(SERVICE, ACCOUNT).getPassword()

  if (isNil(raw)) {
    return migrate(Entry)
  }

  const parsed: unknown = JSON.parse(raw)

  if (!isRecord(parsed)) {
    throw new Error('Bad secrets item')
  }

  const values: Values = {}

  for (const name of SECRET_NAMES) {
    const value = parsed[name]

    if (isString(value) && value !== '') {
      values[name] = value
    }
  }

  return values
}

function writeAll(Entry: EntryCtor, values: Values): void {
  new Entry(SERVICE, ACCOUNT).setPassword(JSON.stringify(values))
}

/** Folds old per-key items into the shared item, then deletes them. */
function migrate(Entry: EntryCtor): Values {
  const values: Values = {}
  const old: Entry[] = []

  for (const name of SECRET_NAMES) {
    const previous = new Entry(SERVICE, name)
    const value = previous.getPassword()

    if (!isNonEmptyString(value)) {
      continue
    }

    values[name] = value
    old.push(previous)
  }

  if (old.length === 0) {
    return values
  }

  writeAll(Entry, values)

  for (const previous of old) {
    try {
      previous.deleteCredential()
    } catch {
      // A leftover old item is harmless once the shared item exists.
    }
  }

  return values
}
