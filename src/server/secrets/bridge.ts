import 'server-only'

import readline from 'node:readline'

import { isBoolean, isNil, isString, isUndefined } from 'lodash-es'

import { isRecord } from '@/core/guards'
import { SECRET_NAMES, type SecretName } from '@/core/secret-names'

import type { SecretBackend } from './index'

export const BRIDGE_PREFIX = '@@upai-secrets '
const DEFAULT_TIMEOUT_MS = 60_000

export interface BridgeOptions {
  input?: NodeJS.ReadableStream
  output?: { write(chunk: string): unknown }
  timeoutMs?: number
}

interface Reply {
  id: number
  ok: boolean
  value?: string | null
  error?: string
  code?: string
}

/** Raised when the parent app reports no usable OS keychain. */
export class KeychainUnavailableError extends Error {
  readonly code = 'unavailable'

  constructor(message = 'No system keychain found') {
    super(message)
    this.name = 'KeychainUnavailableError'
  }
}

interface Pending {
  resolve(reply: Reply): void
  timer: NodeJS.Timeout
}

type Op = 'get' | 'set' | 'remove' | 'getAll'

interface CallParams {
  op: Op
  name: SecretName | ''
  value?: string
}

/** Desktop backend: asks the parent app over stdin/stdout. No keychain code in Node. */
export function bridgeBackend(options: BridgeOptions = {}): SecretBackend {
  const pending = new Map<number, Pending>()
  const output = options.output ?? process.stdout
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let next = 1

  const lines = readline.createInterface({ input: options.input ?? process.stdin })

  lines.on('line', (line) => {
    const reply = parseReply(line)

    if (!reply) return

    const entry = pending.get(reply.id)

    if (!entry) return

    pending.delete(reply.id)
    clearTimeout(entry.timer)
    entry.resolve(reply)
  })

  const call = (params: CallParams) => {
    const { op, name, value } = params

    return new Promise<Reply>((resolve, reject) => {
      const id = next++
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error('Keychain did not answer. Check for a macOS keychain prompt.'))
      }, timeoutMs)

      pending.set(id, { resolve, timer })
      output.write(`${BRIDGE_PREFIX}${JSON.stringify({ id, op, name, value })}\n`)
    })
  }

  return {
    kind: 'keychain',
    getAll: async () => parseAll(unwrap(await call({ op: 'getAll', name: '' })).value),
    get: async (name) => unwrap(await call({ op: 'get', name })).value ?? null,
    set: async (name, value) => {
      unwrap(await call({ op: 'set', name, value }))
    },
    remove: async (name) => {
      unwrap(await call({ op: 'remove', name }))
    },
  }
}

function parseReply(line: string): Reply | null {
  const parsed = parseReplyObject(line)

  if (!parsed) return null

  const reply = parsed as Partial<Reply>

  return hasReplyShape(reply) ? (reply as Reply) : null
}

function parseReplyObject(line: string): Record<string, unknown> | null {
  if (!line.startsWith('{')) return null

  try {
    const parsed: unknown = JSON.parse(line)

    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function hasReplyShape(reply: Partial<Reply>): boolean {
  if (typeof reply.id !== 'number' || !isBoolean(reply.ok)) return false

  if (!isNil(reply.value) && !isString(reply.value)) return false

  if (!isUndefined(reply.error) && !isString(reply.error)) return false

  if (!isUndefined(reply.code) && !isString(reply.code)) return false

  return true
}

function parseAll(raw: string | null | undefined): Partial<Record<SecretName, string>> {
  if (isNil(raw) || raw === '') return {}

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Keychain returned a bad value')
  }

  if (!isRecord(parsed)) throw new Error('Keychain returned a bad value')

  const values: Partial<Record<SecretName, string>> = {}

  for (const name of SECRET_NAMES) {
    const value = parsed[name]

    if (isString(value) && value !== '') values[name] = value
  }

  return values
}

function unwrap(reply: Reply): Reply {
  if (reply.ok) return reply

  if (reply.code === 'unavailable') throw new KeychainUnavailableError(reply.error)

  throw new Error(reply.error ?? 'Keychain request failed')
}
