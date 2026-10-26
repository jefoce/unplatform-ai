import 'server-only'

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { once } from 'node:events'
import { createReadStream, createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import { z } from 'zod'

import { REMOTE_MOCK_MBPS } from '@/core/constants'
import type { TestResult } from '@/core/types'

import { readJson, removeFile } from '../fs/json-file'
import { globalState } from '../global-state'
import { MOCK_REMOTE_PREFIX } from '../local-url'
import { STORAGE_ROOT } from '../paths'
import type { ObjectInfo, ObjectStore, PutObjectParams } from './types'

const MockMetaSchema = z.object({
  size: z.number(),
  serverSha256: z.string(),
})

type MockMeta = z.infer<typeof MockMetaSchema>

const SECRET = globalState('mockRemoteSecret', () => {
  return randomBytes(32)
})

export function createMockStore(): ObjectStore {
  const mode = process.env.REMOTE_MOCK?.trim() === 'fail' ? 'fail' : 'ok'
  const mbps = numberFromEnv('REMOTE_MOCK_MBPS', REMOTE_MOCK_MBPS)

  return {
    id: 'r2',

    async head(key): Promise<ObjectInfo | null> {
      const meta = await readJson(metaPath(key), MockMetaSchema)

      if (!meta) {
        return null
      }

      return { key, size: meta.size, serverSha256: meta.serverSha256 }
    },

    async put(params: PutObjectParams): Promise<ObjectInfo> {
      const { key, file, sha256, onProgress } = params
      const target = objectPath(key)

      try {
        const { size } = await copyThrottled({
          source: file,
          target,
          mbps,
          mode,
          onProgress: onProgress ?? undefined,
        })

        const meta: MockMeta = { size, serverSha256: sha256 }

        await fs.writeFile(metaPath(key), JSON.stringify(meta), 'utf8')

        return { key, size, serverSha256: sha256 }
      } catch (error) {
        await Promise.all([removeFile(target), removeFile(metaPath(key))])

        throw error
      }
    },

    async presign(params): Promise<string> {
      const { key, ttlSec } = params
      const exp = Math.floor(Date.now() / 1000) + Math.max(1, ttlSec)

      return `${MOCK_REMOTE_PREFIX}${key}?exp=${exp}&sig=${sign(key, exp)}`
    },

    async delete(key): Promise<void> {
      await Promise.all([removeFile(objectPath(key)), removeFile(metaPath(key))])
    },

    async testConnection(): Promise<TestResult> {
      return { ok: true, mock: true }
    },
  }
}

interface VerifyMockSignatureParams {
  key: string
  exp: number
  sig: string
}

/** Resolves a key inside the mock dir, or null when it escapes. */
export function mockObjectPath(key: string): string | null {
  const root = mockDir()
  const resolved = path.resolve(root, key)

  if (resolved.startsWith(`${root}${path.sep}`)) {
    return resolved
  }

  return null
}

/** Validates expiry and the per-process HMAC without exposing the secret. */
export function verifyMockSignature(params: VerifyMockSignatureParams): boolean {
  const { key, exp, sig } = params

  if (!Number.isSafeInteger(exp) || exp * 1000 < Date.now()) {
    return false
  }

  const expected = Buffer.from(sign(key, exp), 'utf8')
  const actual = Buffer.from(sig, 'utf8')

  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

interface CopyThrottledParams {
  source: string
  target: string
  mbps: number
  mode: 'ok' | 'fail'
  onProgress?: (sent: number, total: number) => void
}

interface CopyThrottledResult {
  size: number
}

async function copyThrottled(params: CopyThrottledParams): Promise<CopyThrottledResult> {
  const { source, target, mbps, mode, onProgress } = params

  await fs.mkdir(path.dirname(target), { recursive: true })
  const { size } = await fs.stat(source)
  const bytesPerMs = (mbps * 1024 * 1024) / 1000
  const reader = createReadStream(source)
  const writer = createWriteStream(target)
  let sent = 0

  try {
    for await (const chunk of reader) {
      if (!writer.write(chunk)) {
        await once(writer, 'drain')
      }

      sent += chunk.length
      onProgress?.(sent, size)

      if (mode === 'fail' && sent >= size / 2) {
        throw new Error('Mock upload failed')
      }

      if (bytesPerMs > 0) {
        await delay(chunk.length / bytesPerMs)
      }
    }

    writer.end()
    await once(writer, 'finish')

    return { size }
  } catch (error) {
    reader.destroy()
    writer.destroy()
    await removeFile(target)

    throw error
  }
}

function mockDir(): string {
  return path.join(STORAGE_ROOT, '.cache', 'remote-mock')
}

function objectPath(key: string): string {
  return path.join(mockDir(), key)
}

function metaPath(key: string): string {
  return `${objectPath(key)}.json`
}

function sign(key: string, exp: number): string {
  return createHmac('sha256', SECRET).update(`${key}:${exp}`).digest('hex')
}

function numberFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name])

  if (Number.isFinite(value) && value > 0) {
    return value
  }

  return fallback
}
