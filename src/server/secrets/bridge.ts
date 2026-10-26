import 'server-only'

import readline from 'node:readline'

import { isString } from 'lodash-es'
import { z } from 'zod'

import { isNonEmptyString, isRecord } from '@/core/guards'
import { SECRET_NAMES, type SecretName } from '@/core/secret-names'

import type { SecretBackend } from './types'

export const BRIDGE_PREFIX = '@@upai-secrets '
const DEFAULT_TIMEOUT_MS = 60_000

interface BridgeOutput {
  write(chunk: string): unknown
}

export interface BridgeOptions {
  input?: NodeJS.ReadableStream
  output?: BridgeOutput
  timeoutMs?: number
}

const BridgeReplySchema = z.object({
  id: z.number(),
  ok: z.boolean(),
  value: z.string().nullish(),
  error: z.string().optional(),
  code: z.string().optional(),
})

type Reply = z.infer<typeof BridgeReplySchema>

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

    if (!reply) {
      return
    }

    const entry = pending.get(reply.id)

    if (!entry) {
      return
    }

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
    getAll: async () => {
      return parseAll(unwrap(await call({ op: 'getAll', name: '' })).value)
    },
    get: async (name) => {
      return unwrap(await call({ op: 'get', name })).value ?? null
    },
    set: async (name, value) => {
      unwrap(await call({ op: 'set', name, value }))
    },
    remove: async (name) => {
      unwrap(await call({ op: 'remove', name }))
    },
  }
}

function parseReply(line: string): Reply | null {
  let raw: unknown

  try {
    raw = JSON.parse(line)
  } catch {
    return null
  }

  const parsed = BridgeReplySchema.safeParse(raw)

  if (!parsed.success) {
    return null
  }

  return parsed.data
}

function parseAll(raw: string | null | undefined): Partial<Record<SecretName, string>> {
  if (!isNonEmptyString(raw)) {
    return {}
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Keychain returned a bad value')
  }

  if (!isRecord(parsed)) {
    throw new Error('Keychain returned a bad value')
  }

  const values: Partial<Record<SecretName, string>> = {}

  for (const name of SECRET_NAMES) {
    const value = parsed[name]

    if (isString(value) && value !== '') {
      values[name] = value
    }
  }

  return values
}

function unwrap(reply: Reply): Reply {
  if (reply.ok) {
    return reply
  }

  if (reply.code === 'unavailable') {
    throw new KeychainUnavailableError(reply.error)
  }

  throw new Error(reply.error ?? 'Keychain request failed')
}
