import 'server-only'

import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { isNil, isObject, isString } from 'lodash-es'

import { type SecretName } from '@/core/secret-names'

import { messageOf } from '../errors'
import { getSecret } from '../secrets'
import type { RemoteObjectInfo, RemoteStore } from './remote-store'

const PART_SIZE = 64 * 1024 * 1024

export function createR2Store(): RemoteStore {
  const { bucket, client } = r2Config()

  return {
    async head(key): Promise<RemoteObjectInfo | null> {
      try {
        const res = await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key, ChecksumMode: 'ENABLED' }),
        )

        return {
          key,
          size: res.ContentLength ?? 0,
          serverSha256: res.ChecksumSHA256 ?? null,
        }
      } catch (error) {
        if (isNotFound(error)) return null

        throw error
      }
    },

    async put(params): Promise<RemoteObjectInfo> {
      const { key, file, opts } = params
      const stats = await fs.stat(file)
      const isMultipart = stats.size > PART_SIZE
      const checksum: { ChecksumSHA256?: string } = {}

      if (!isMultipart) checksum.ChecksumSHA256 = opts.sha256

      const upload = new Upload({
        client,
        params: {
          Bucket: bucket,
          Key: key,
          Body: createReadStream(file),
          ContentType: opts.contentType,
          ContentLength: stats.size,
          ChecksumAlgorithm: 'SHA256',
          ...checksum,
        },
        partSize: PART_SIZE,
        queueSize: 2,
      })

      upload.on('httpUploadProgress', ({ loaded, total }) => {
        opts.onProgress?.(loaded ?? 0, total ?? stats.size)
      })
      const res = await upload.done()

      return { key, size: stats.size, serverSha256: res.ChecksumSHA256 ?? null }
    },

    async presign(params): Promise<string> {
      const { key, ttlSec, contentType } = params

      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentType: contentType }),
        { expiresIn: ttlSec },
      )
    },

    async delete(key): Promise<void> {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    },
  }
}

function r2Config(): { bucket: string; client: S3Client } {
  return {
    bucket: required('R2_BUCKET'),
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${required('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: required('R2_ACCESS_KEY_ID'),
        secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    }),
  }
}

/** Writes, reads and deletes a 4-byte probe. Returns the S3 error code on failure. */
export async function testR2(): Promise<{ ok: boolean; error?: string }> {
  let config: ReturnType<typeof r2Config>

  try {
    config = r2Config()
  } catch (error) {
    return { ok: false, error: messageOf(error, 'R2 test failed') }
  }

  const { bucket, client } = config
  const key = `probe/${randomUUID()}.txt`

  try {
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: 'test', ContentLength: 4 }),
    )
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))

    return { ok: true }
  } catch (error) {
    return { ok: false, error: s3ErrorCode(error) }
  } finally {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {})
  }
}

function s3ErrorCode(error: unknown): string {
  if (isObject(error)) {
    const name = (error as { name?: unknown }).name

    if (isString(name) && name !== '') return name
  }

  return 'R2 test failed'
}

function required(name: SecretName): string {
  const value = getSecret(name)

  if (isNil(value) || value === '') throw new Error(`${name} is not set`)

  return value
}

function isNotFound(error: unknown): boolean {
  if (!isObject(error)) return false

  const meta = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
  const name = (error as { name?: string }).name

  return meta?.httpStatusCode === 404 || name === 'NotFound' || name === 'NoSuchKey'
}
