import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SECRET_NAMES } from '../src/core/secret-names'

const keychainBackendMock = vi.hoisted(() => {
  return vi.fn(async () => {
    return null
  })
})

vi.mock('@/server/secrets/keychain', () => {
  return { keychainBackend: keychainBackendMock }
})

const originalPlatform = process.platform

let root = ''

function setPlatform(value: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { configurable: true, value })
}

async function loadSecrets() {
  vi.resetModules()
  const secrets = await import('@/server/secrets')

  secrets.__resetSecretsForTests()
  await secrets.secretsReady()

  return secrets
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-secrets-backend-'))
  vi.stubEnv('STORAGE_ROOT', root)
  vi.stubEnv('APP_TOKEN', '')
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('UPAI_SECRETS_BACKEND', '')

  for (const name of SECRET_NAMES) {
    vi.stubEnv(name, '')
  }

  keychainBackendMock.mockReset()
})

afterEach(async () => {
  setPlatform(originalPlatform)
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await fs.rm(root, { recursive: true, force: true })
})

describe('secrets backend selection', () => {
  it.each(['darwin', 'win32'] as const)(
    'reports an unavailable keychain on %s without creating a secrets file',
    async (platform) => {
      setPlatform(platform)
      keychainBackendMock.mockResolvedValue(null)
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const secrets = await loadSecrets()

      expect(secrets.secretStatus().backend).toBeNull()
      expect(secrets.secretStatus().loadError).toContain('Keys could not be saved')

      await expect(fs.stat(path.join(root, 'secrets.json'))).rejects.toMatchObject({
        code: 'ENOENT',
      })
    },
  )

  it('never reads a secrets file on win32', async () => {
    setPlatform('win32')
    keychainBackendMock.mockResolvedValue(null)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await fs.writeFile(
      path.join(root, 'secrets.json'),
      JSON.stringify({ OPENROUTER_API_KEY: 'sk-or-v1-test' }),
      { mode: 0o600 },
    )

    const secrets = await loadSecrets()

    expect(secrets.getSecret('OPENROUTER_API_KEY')).toBeNull()
  })

  it('falls back to the file backend on linux', async () => {
    setPlatform('linux')
    keychainBackendMock.mockResolvedValue(null)

    const secrets = await loadSecrets()

    expect(secrets.secretStatus().backend).toBe('file')

    await secrets.setSecrets({ OPENROUTER_API_KEY: 'sk-or-v1-test' })

    const stats = await fs.stat(path.join(root, 'secrets.json'))

    // NTFS reports 0o666 for regular files, so only POSIX hosts can assert 0600.
    if (originalPlatform !== 'win32') {
      expect(stats.mode & 0o777).toBe(0o600)
    }
  })

  it('ignores the file override in production on win32', async () => {
    setPlatform('win32')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('UPAI_SECRETS_BACKEND', 'file')
    keychainBackendMock.mockResolvedValue(null)

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    vi.spyOn(console, 'error').mockImplementation(() => {})

    const secrets = await loadSecrets()

    expect(secrets.secretStatus().loadError).toContain('Keys could not be saved')
    expect(warn).toHaveBeenCalled()

    await expect(fs.stat(path.join(root, 'secrets.json'))).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })
})
