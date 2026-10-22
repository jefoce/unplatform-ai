import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let root = ''

async function loadFileBackend() {
  vi.resetModules()
  const { fileBackend } = await import('@/server/secrets/file')

  return fileBackend()
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'upai-secrets-file-'))
  vi.stubEnv('STORAGE_ROOT', root)
})

afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await fs.rm(root, { recursive: true, force: true })
})

describe('secrets file backend', () => {
  // Windows has no POSIX modes, the file backend is Linux-only (keychain/Credential Manager elsewhere).
  describe.skipIf(process.platform === 'win32')('POSIX modes', () => {
    it('writes the file with mode 0600 and reads it back', async () => {
      const backend = await loadFileBackend()

      await backend.set('R2_BUCKET', 'bucket')

      const stats = await fs.stat(path.join(root, 'secrets.json'))

      expect(stats.mode & 0o777).toBe(0o600)
      expect(await backend.get('R2_BUCKET')).toBe('bucket')
    })

    it('ignores a file readable by group or others', async () => {
      const file = path.join(root, 'secrets.json')

      await fs.writeFile(file, JSON.stringify({ R2_BUCKET: 'bucket' }))
      await fs.chmod(file, 0o644)
      // eslint-disable-next-line max-nested-callbacks -- nested describes add one level
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const backend = await loadFileBackend()

      expect(await backend.get('R2_BUCKET')).toBeNull()
      expect(warn).toHaveBeenCalled()
    })
  })
})
