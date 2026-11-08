import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createS3Store, s3ErrorText } from '@/server/storage/s3-store'

vi.mock('server-only', () => {
  return {}
})

const state = vi.hoisted(() => {
  const initial: { probeError: unknown; uploadError: unknown } = {
    probeError: null,
    uploadError: null,
  }

  return initial
})

vi.mock('@aws-sdk/client-s3', () => {
  class Command {
    input: unknown

    constructor(input: unknown) {
      this.input = input
    }
  }

  class S3Client {
    async send(): Promise<unknown> {
      if (state.probeError !== null) {
        throw state.probeError
      }

      return {}
    }
  }

  return {
    DeleteObjectCommand: Command,
    GetObjectCommand: Command,
    HeadObjectCommand: Command,
    ListObjectsV2Command: Command,
    PutObjectCommand: Command,
    S3Client,
  }
})

vi.mock('@aws-sdk/lib-storage', () => {
  class Upload {
    on(): void {}

    async done(): Promise<unknown> {
      if (state.uploadError !== null) {
        throw state.uploadError
      }

      return {}
    }

    async abort(): Promise<void> {}
  }

  return { Upload }
})

vi.mock('@aws-sdk/s3-request-presigner', () => {
  return {
    getSignedUrl: async () => {
      return 'https://example.test/signed'
    },
  }
})

const DIR = path.join(os.tmpdir(), `cf-s3-store-${process.pid}`)
const FILE = path.join(DIR, 'reference.bin')

const STORE = createS3Store({
  endpoint: 'https://example.test',
  region: 'auto',
  bucket: 'bucket',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
})

beforeEach(async () => {
  state.probeError = null
  state.uploadError = null
  await fs.mkdir(DIR, { recursive: true })
  await fs.writeFile(FILE, 'reference-bytes')
})

afterAll(async () => {
  await fs.rm(DIR, { recursive: true, force: true })
})

describe('s3ErrorText', () => {
  const CASES: Array<{ error: unknown; code: string }> = [
    {
      error: { name: 'UnknownError', $metadata: { httpStatusCode: 401 } },
      code: 'r2:401:UnknownError',
    },
    {
      error: { name: 'AccessDenied', $metadata: { httpStatusCode: 403 } },
      code: 'r2:403:AccessDenied',
    },
    {
      error: { name: 'NoSuchBucket', $metadata: { httpStatusCode: 404 } },
      code: 'r2:404:NoSuchBucket',
    },
    { error: { name: 'UnknownError' }, code: 'r2:network:UnknownError' },
    { error: 'boom', code: 'r2:network:unknown' },
  ]

  it.each(CASES)('maps %j', ({ error, code }) => {
    expect(s3ErrorText(error)).toBe(code)
  })
})

describe('S3 store failures', () => {
  it('throws the r2 code from put', async () => {
    state.uploadError = { name: 'UnknownError', $metadata: { httpStatusCode: 401 } }

    await expect(
      STORE.put({
        key: 'refs/test.bin',
        file: FILE,
        contentType: 'application/octet-stream',
        sha256: 'test-sha256',
        onProgress: null,
      }),
    ).rejects.toMatchObject({ message: 'r2:401:UnknownError' })
  })

  it('returns the r2 code from the connection test', async () => {
    state.probeError = { name: 'AccessDenied', $metadata: { httpStatusCode: 403 } }

    await expect(STORE.testConnection()).resolves.toEqual({
      ok: false,
      error: 'r2:403:AccessDenied',
    })
  })
})
