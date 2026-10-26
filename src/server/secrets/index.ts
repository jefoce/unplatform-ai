import 'server-only'

import { isNil } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import { R2_NAMES, SECRET_NAMES, type SecretName } from '@/core/secret-names'
import type { SecretKeyStatus, SecretSource, SecretStatus } from '@/core/types'

import { HttpError } from '../errors'
import { globalState } from '../global-state'
import { withLock } from '../sync/lock'
import { pickBackend, readStored } from './backend'
import { KeychainUnavailableError } from './bridge'
import type { SecretBackend } from './types'

interface Entry {
  value: string
  source: SecretSource
}

interface SecretsState {
  loaded: boolean
  backend: SecretBackend | null
  values: Map<SecretName, Entry>
  listeners: Set<() => void>
  loading: Promise<void> | null
  loadError: string | null
}

const state = globalState<SecretsState>('secrets', () => {
  return {
    loaded: false,
    backend: null,
    values: new Map(),
    listeners: new Set(),
    loading: null,
    loadError: null,
  }
})

/** Starts or waits for the one-time load. */
export function secretsReady(): Promise<void> {
  state.loading ??= load()

  return state.loading
}

/** Drops a failed load and tries again, for the Settings retry button. */
export function reloadSecrets(): Promise<void> {
  state.loading = null
  state.loaded = false
  state.loadError = null
  state.values.clear()

  for (const listener of state.listeners) {
    listener()
  }

  return secretsReady()
}

async function load(): Promise<void> {
  state.loadError = null

  try {
    const { backend, stored } = await readStored(state.backend ?? (await pickBackend()))

    state.backend = backend

    for (const name of SECRET_NAMES) {
      const env = process.env[name]?.trim()

      if (isNonEmptyString(env)) {
        state.values.set(name, { value: env, source: 'env' })
        continue
      }

      const value = stored[name]

      if (isNonEmptyString(value)) {
        state.values.set(name, { value, source: backend.kind })
      }
    }
  } catch (error) {
    console.error('[unplatform-ai] secrets load failed', error)

    const loadError =
      error instanceof KeychainUnavailableError
        ? 'Keys could not be saved. The system keychain is unavailable.'
        : 'Keychain access was denied or timed out'

    state.loadError = loadError
  } finally {
    state.loaded = true

    for (const listener of state.listeners) {
      listener()
    }
  }
}

/** Sync read from memory. Use this instead of reading process.env directly. */
export function getSecret(name: SecretName): string | null {
  return state.values.get(name)?.value ?? null
}

/** Applies changes at once (null removes). Env keys are read-only. */
export async function setSecrets(
  changes: Partial<Record<SecretName, string | null>>,
): Promise<void> {
  await withLock('secrets', () => {
    return applySecrets(changes)
  })
}

async function applySecrets(changes: Partial<Record<SecretName, string | null>>): Promise<void> {
  await secretsReady()

  if (isNonEmptyString(state.loadError)) {
    throw new HttpError(409, 'Keychain not loaded')
  }

  const backend = state.backend

  if (!backend) {
    throw new HttpError(500, 'No secret backend available')
  }

  const entries = Object.entries(changes) as [SecretName, string | null][]
  const next = nextValues({ entries, backend })

  assertR2Group(next)
  await persistEntries({ entries, backend })

  state.values = next

  for (const listener of state.listeners) {
    listener()
  }
}

interface NextValuesParams {
  entries: [SecretName, string | null][]
  backend: SecretBackend
}

function nextValues(params: NextValuesParams): Map<SecretName, Entry> {
  const { entries, backend } = params
  const next = new Map(state.values)

  for (const [name, value] of entries) {
    if (state.values.get(name)?.source === 'env') {
      throw new HttpError(409, `${name} is set by environment`)
    }

    if (isNil(value)) {
      next.delete(name)
      continue
    }

    next.set(name, { value, source: backend.kind })
  }

  return next
}

interface PersistEntriesParams {
  entries: [SecretName, string | null][]
  backend: SecretBackend
}

async function persistEntries(params: PersistEntriesParams): Promise<void> {
  const { entries, backend } = params

  try {
    for (const [name, value] of entries) {
      await persistEntry({ name, value, backend })
    }
  } catch (error) {
    await recoverFromSaveFailure(error)
  }
}

interface PersistEntryParams {
  name: SecretName
  value: string | null
  backend: SecretBackend
}

async function persistEntry(params: PersistEntryParams): Promise<void> {
  const { name, value, backend } = params

  if (!isNil(value)) {
    await backend.set(name, value)

    return
  }

  if (!state.values.has(name)) {
    return
  }

  await backend.remove(name)
}

async function recoverFromSaveFailure(error: unknown): Promise<never> {
  console.error('[unplatform-ai] secret save failed', error)
  state.loading = null
  state.values.clear()
  await secretsReady()

  for (const listener of state.listeners) {
    listener()
  }

  throw new HttpError(500, 'Could not save to the keychain')
}

/** Per-key status. Hints are the last four characters, never the value. */
export function secretStatus(): SecretStatus {
  const keys = {} as Record<SecretName, SecretKeyStatus>

  for (const name of SECRET_NAMES) {
    const entry = state.values.get(name)

    if (!entry) {
      keys[name] = { set: false, source: null, hint: null }

      continue
    }

    keys[name] = { set: true, source: entry.source, hint: hintFor(entry.value) }
  }

  return {
    backend: state.backend?.kind ?? null,
    loading: !state.loaded,
    loadError: state.loadError,
    keys,
  }
}

/** Short values reveal too much in the last four characters. */
const hintFor = (value: string): string | null => {
  if (value.length < 12) {
    return null
  }

  return value.slice(-4)
}

/** Fires after a save. Returns an unsubscribe function. */
export function onSecretsChange(listener: () => void): () => void {
  state.listeners.add(listener)

  return () => {
    return state.listeners.delete(listener)
  }
}

function assertR2Group(values: Map<SecretName, Entry>): void {
  const count = R2_NAMES.filter((name) => {
    return values.has(name)
  }).length

  if (count !== 0 && count !== R2_NAMES.length) {
    throw new HttpError(400, 'R2 needs all four fields')
  }
}

/** Test hook: installs a backend and clears loaded values. */
export function __setSecretsBackendForTests(backend: SecretBackend | null): void {
  state.loaded = false
  state.backend = backend
  state.values.clear()
  state.loading = null
  state.loadError = null
}

/** Test hook: drops all in-memory secret state. */
export function __resetSecretsForTests(): void {
  state.loaded = false
  state.backend = null
  state.values.clear()
  state.listeners.clear()
  state.loading = null
  state.loadError = null
}
