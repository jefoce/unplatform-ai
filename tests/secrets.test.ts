import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SECRET_NAMES } from '@/core/secret-names'
import { onSecretsChange } from '@/server/secrets'

import { memoryBackend, setup } from './helpers/secrets'

const originalPlatform = process.platform

let root = ''

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'upai-secrets-'))
  vi.stubEnv('STORAGE_ROOT', root)

  for (const name of SECRET_NAMES) {
    vi.stubEnv(name, '')
  }
})

afterEach(async () => {
  Object.defineProperty(process, 'platform', { configurable: true, value: originalPlatform })
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await fs.rm(root, { recursive: true, force: true })
})

describe('secrets', () => {
  it('prefers env and rejects writes with 409', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'env-key')
    const { secrets } = await setup(memoryBackend({ OPENROUTER_API_KEY: 'stored' }))

    expect(secrets.getSecret('OPENROUTER_API_KEY')).toBe('env-key')
    expect(secrets.secretStatus().keys.OPENROUTER_API_KEY.source).toBe('env')

    await expect(secrets.setSecrets({ OPENROUTER_API_KEY: 'next' })).rejects.toMatchObject({
      status: 409,
      message: 'OPENROUTER_API_KEY is set by environment',
    })

    await expect(secrets.setSecrets({ OPENROUTER_API_KEY: null })).rejects.toMatchObject({
      status: 409,
    })
  })

  it('sets and reads a key', async () => {
    const { secrets, backend } = await setup()

    await secrets.setSecrets({ OPENROUTER_API_KEY: 'abc12345' })

    expect(secrets.getSecret('OPENROUTER_API_KEY')).toBe('abc12345')
    expect(backend.store.get('OPENROUTER_API_KEY')).toBe('abc12345')
    expect(secrets.secretStatus().keys.OPENROUTER_API_KEY.source).toBe('file')
  })

  it('removes a key', async () => {
    const { secrets, backend } = await setup()

    await secrets.setSecrets({ OPENROUTER_API_KEY: 'abc12345' })

    await secrets.setSecrets({ OPENROUTER_API_KEY: null })

    expect(secrets.getSecret('OPENROUTER_API_KEY')).toBeNull()
    expect(backend.store.has('OPENROUTER_API_KEY')).toBe(false)
  })

  it('rejects a partial R2 group with 400', async () => {
    const { secrets, backend } = await setup()

    await expect(secrets.setSecrets({ R2_BUCKET: 'bucket' })).rejects.toMatchObject({
      status: 400,
      message: 'R2 needs all four fields',
    })

    expect(backend.store.size).toBe(0)
  })

  it('notifies listeners once per save', async () => {
    const { secrets } = await setup()
    const listener = vi.fn()
    const off = onSecretsChange(listener)

    await secrets.setSecrets({
      OPENROUTER_API_KEY: 'abc12345',
      OPENROUTER_MANAGEMENT_KEY: 'def67890',
    })

    expect(listener).toHaveBeenCalledTimes(1)

    off()
    await secrets.setSecrets({ OPENROUTER_API_KEY: 'abc99999' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('adds one listener when the same registration runs twice', async () => {
    const { secrets } = await setup()
    const listener = vi.fn()

    secrets.registerSecretsListener('pricing', listener)
    secrets.registerSecretsListener('pricing', listener)

    await secrets.setSecrets({ OPENROUTER_API_KEY: 'abc12345' })

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('skips the backend remove for a key that is not stored', async () => {
    const { secrets, backend } = await setup()
    const remove = vi.spyOn(backend, 'remove')

    await secrets.setSecrets({ OPENROUTER_API_KEY: null })

    expect(remove).not.toHaveBeenCalled()
  })
})

// eslint-disable-next-line max-lines-per-function -- backend cases stay in one describe
describe('secrets backend', () => {
  it('reloads stored keys and reports a 500 when the backend fails', async () => {
    const backend = memoryBackend({ OPENROUTER_API_KEY: 'stored' })

    backend.set = async () => {
      throw new Error('keychain denied')
    }

    const { secrets } = await setup(backend)

    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(secrets.setSecrets({ OPENROUTER_MANAGEMENT_KEY: 'next' })).rejects.toMatchObject({
      status: 500,
      message: 'Could not save to the keychain',
    })

    expect(secrets.getSecret('OPENROUTER_MANAGEMENT_KEY')).toBeNull()
    expect(secrets.getSecret('OPENROUTER_API_KEY')).toBe('stored')
  })

  it('serializes concurrent saves so both keys survive', async () => {
    const { secrets } = await setup()

    await Promise.all([
      secrets.setSecrets({ OPENROUTER_API_KEY: 'key-a' }),
      secrets.setSecrets({ OPENROUTER_MANAGEMENT_KEY: 'key-b' }),
    ])

    expect(secrets.getSecret('OPENROUTER_API_KEY')).toBe('key-a')
    expect(secrets.getSecret('OPENROUTER_MANAGEMENT_KEY')).toBe('key-b')
  })

  it('ignores stored values that fail the per-key schema', async () => {
    await fs.writeFile(
      path.join(root, 'secrets.json'),
      JSON.stringify({ R2_ACCOUNT_ID: 'invalid-hex', R2_BUCKET: 'bucket' }),
      { mode: 0o600 },
    )

    vi.resetModules()
    const { fileBackend } = await import('@/server/secrets/file')
    const backend = fileBackend()

    expect(await backend.get('R2_ACCOUNT_ID')).toBeNull()
    expect(await backend.get('R2_BUCKET')).toBe('bucket')
  })

  it('keeps a load error visible and refuses saves', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const backend = memoryBackend({ OPENROUTER_API_KEY: 'stored' })

    backend.getAll = async () => {
      throw new Error('denied')
    }

    const { secrets } = await setup(backend)

    expect(secrets.secretStatus().loadError).toBe('Keychain access was denied or timed out')
    expect(secrets.secretStatus().keys.OPENROUTER_API_KEY.set).toBe(false)

    await expect(secrets.setSecrets({ OPENROUTER_MANAGEMENT_KEY: 'next' })).rejects.toMatchObject({
      status: 409,
      message: 'Keychain not loaded',
    })
  })

  it('falls back to the file backend when the keychain is unavailable', async () => {
    Object.defineProperty(process, 'platform', { configurable: true, value: 'linux' })
    vi.resetModules()
    const { KeychainUnavailableError } = await import('@/server/secrets/bridge')
    const bridge = memoryBackend()

    bridge.getAll = async () => {
      throw new KeychainUnavailableError('no secret service')
    }

    const secrets = await import('@/server/secrets')

    secrets.__resetSecretsForTests()
    secrets.__setSecretsBackendForTests(bridge)
    await secrets.secretsReady()

    expect(secrets.secretStatus().backend).toBe('file')
    expect(secrets.secretStatus().loadError).toBeNull()

    await secrets.setSecrets({ OPENROUTER_API_KEY: 'abc12345' })

    if (originalPlatform === 'win32') {
      // NTFS reports 0666, so the mocked Linux 0600 gate would ignore the file.
      const raw = JSON.parse(await fs.readFile(path.join(root, 'secrets.json'), 'utf8')) as {
        OPENROUTER_API_KEY?: string
      }

      expect(raw.OPENROUTER_API_KEY).toBe('abc12345')

      return
    }

    const { fileBackend } = await import('@/server/secrets/file')

    expect(await fileBackend().get('OPENROUTER_API_KEY')).toBe('abc12345')
  })

  it.each(['darwin', 'win32'] as const)(
    'does not fall back to a file on %s when the keychain is unavailable',
    async (platform) => {
      Object.defineProperty(process, 'platform', { configurable: true, value: platform })
      vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.resetModules()
      const { KeychainUnavailableError } = await import('@/server/secrets/bridge')
      const bridge = memoryBackend()

      bridge.getAll = async () => {
        throw new KeychainUnavailableError('no keychain')
      }

      const secrets = await import('@/server/secrets')

      secrets.__resetSecretsForTests()
      secrets.__setSecretsBackendForTests(bridge)
      await secrets.secretsReady()

      expect(secrets.getSecret('OPENROUTER_API_KEY')).toBeNull()
      expect(secrets.secretStatus().loadError).toContain('Keys could not be saved')

      await expect(fs.stat(path.join(root, 'secrets.json'))).rejects.toMatchObject({
        code: 'ENOENT',
      })
    },
  )
})

describe('secrets reload', () => {
  it('reloads after a transient load error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const backend = memoryBackend({ OPENROUTER_API_KEY: 'stored' })
    const read = backend.getAll
    let isDenied = true

    backend.getAll = async () => {
      if (isDenied) {
        throw new Error('denied')
      }

      return read()
    }

    const { secrets } = await setup(backend)

    expect(secrets.secretStatus().loadError).not.toBeNull()

    isDenied = false
    await secrets.reloadSecrets()

    expect(secrets.secretStatus().loadError).toBeNull()
    expect(secrets.getSecret('OPENROUTER_API_KEY')).toBe('stored')
  })
})

describe('secrets status', () => {
  it('returns only the last four characters as a hint, and none for short values', async () => {
    const { secrets } = await setup()

    await secrets.setSecrets({
      OPENROUTER_API_KEY: 'abcdefghijkl',
      OPENROUTER_MANAGEMENT_KEY: 'short',
    })

    const status = secrets.secretStatus()

    expect(status.keys.OPENROUTER_API_KEY).toMatchObject({
      set: true,
      hint: 'ijkl',
    })

    expect(status.keys.OPENROUTER_MANAGEMENT_KEY.hint).toBeNull()
    expect(JSON.stringify(status)).not.toContain('abcdefghijkl')
  })
})
