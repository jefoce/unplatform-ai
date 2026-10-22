import { PassThrough } from 'node:stream'

import { isNil } from 'lodash-es'
import { describe, expect, it, vi } from 'vitest'

import {
  __resetSecretsForTests,
  __setSecretsBackendForTests,
  secretsReady,
  secretStatus,
  setSecrets,
} from '@/server/secrets'
import { BRIDGE_PREFIX, bridgeBackend, KeychainUnavailableError } from '@/server/secrets/bridge'

interface SentLine {
  id: number
  op: string
  name: string
  value?: string
}

function setup(timeoutMs = 1_000) {
  const input = new PassThrough()
  const sent: string[] = []
  const backend = bridgeBackend({
    input,
    output: {
      write: (chunk) => {
        sent.push(chunk)

        return true
      },
    },
    timeoutMs,
  })

  return { input, sent, backend }
}

function request(sent: string[]): SentLine {
  const line = sent.at(-1)

  if (isNil(line) || line === '') throw new Error('no request written')

  expect(line.startsWith(BRIDGE_PREFIX)).toBe(true)

  return JSON.parse(line.slice(BRIDGE_PREFIX.length))
}

function reply(input: PassThrough, payload: Record<string, unknown>) {
  input.write(`${JSON.stringify(payload)}\n`)
}

describe('secrets bridge', () => {
  it('gets a value over the JSON line protocol', async () => {
    const { input, sent, backend } = setup()

    const pending = backend.get('OPENROUTER_API_KEY')
    const line = request(sent)

    expect(line).toMatchObject({ op: 'get', name: 'OPENROUTER_API_KEY' })
    reply(input, { id: line.id, ok: true, value: 'abc12345' })

    await expect(pending).resolves.toBe('abc12345')
  })

  it('sets and removes keys', async () => {
    const { input, sent, backend } = setup()

    const setting = backend.set('R2_BUCKET', 'my-bucket')
    const setLine = request(sent)

    expect(setLine).toMatchObject({ op: 'set', name: 'R2_BUCKET', value: 'my-bucket' })
    reply(input, { id: setLine.id, ok: true, value: null })
    await expect(setting).resolves.toBeUndefined()

    const removing = backend.remove('R2_BUCKET')
    const removeLine = request(sent)

    expect(removeLine).toMatchObject({ op: 'remove', name: 'R2_BUCKET' })
    reply(input, { id: removeLine.id, ok: true, value: null })
    await expect(removing).resolves.toBeUndefined()
  })

  it('loads every key in one request', async () => {
    const { input, sent, backend } = setup()

    const pending = backend.getAll()
    const line = request(sent)

    expect(line).toMatchObject({ op: 'getAll', name: '' })
    reply(input, {
      id: line.id,
      ok: true,
      value: JSON.stringify({ OPENROUTER_API_KEY: 'abc12345', R2_BUCKET: 'bucket', NOPE: 'x' }),
    })

    await expect(pending).resolves.toEqual({ OPENROUTER_API_KEY: 'abc12345', R2_BUCKET: 'bucket' })
  })
})

describe('secrets bridge failures', () => {
  it('rejects a failed reply', async () => {
    const { input, sent, backend } = setup()

    const pending = backend.get('OPENROUTER_API_KEY')
    const line = request(sent)

    reply(input, { id: line.id, ok: false, error: 'Keychain access was denied' })

    await expect(pending).rejects.toThrow('Keychain access was denied')
  })

  it('turns a failed reply into a visible load error and blocks saves', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const input = new PassThrough()
    const sent: string[] = []
    const backend = bridgeBackend({
      input,
      output: {
        write: (chunk) => {
          sent.push(chunk)

          return true
        },
      },
      timeoutMs: 100,
    })

    __resetSecretsForTests()
    __setSecretsBackendForTests(backend)

    const loading = secretsReady()

    reply(input, { id: request(sent).id, ok: false, error: 'Keychain access was denied' })
    await loading

    expect(secretStatus().loadError).toBe('Keychain access was denied or timed out')
    expect(secretStatus().keys.OPENROUTER_API_KEY.set).toBe(false)
    await expect(setSecrets({ OPENROUTER_API_KEY: 'abc12345' })).rejects.toMatchObject({
      status: 409,
      message: 'Keychain not loaded',
    })
  })

  it('throws a typed error when the keychain is unavailable', async () => {
    const { input, sent, backend } = setup()

    const pending = backend.get('OPENROUTER_API_KEY')

    reply(input, {
      id: request(sent).id,
      ok: false,
      code: 'unavailable',
      error: 'no secret service',
    })

    await expect(pending).rejects.toBeInstanceOf(KeychainUnavailableError)
  })

  it('rejects when the parent app does not answer', async () => {
    const { backend } = setup(20)

    await expect(backend.get('OPENROUTER_API_KEY')).rejects.toThrow(
      'Keychain did not answer. Check for a macOS keychain prompt.',
    )
  })

  it('ignores replies with an unknown id', async () => {
    const { input, sent, backend } = setup()

    const pending = backend.get('OPENROUTER_API_KEY')
    const line = request(sent)

    reply(input, { id: line.id + 1, ok: true, value: 'wrong' })
    await new Promise((resolve) => setTimeout(resolve, 20))
    reply(input, { id: line.id, ok: true, value: 'right' })

    await expect(pending).resolves.toBe('right')
  })
})
