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
import { isObject, isString } from 'lodash-es'

import type { TestResult } from '@/core/types'

import type { ObjectInfo, ObjectStore } from './types'

const PART_SIZE = 64 * 1024 * 1024

export interface S3StoreConfig {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
}

interface ChecksumFields {
  ChecksumSHA256?: string
}

interface S3ClientBundle {
  bucket: string
  client: S3Client
}

interface ErrorWithName {
  name?: unknown
}

interface S3ErrorMetadata {
  httpStatusCode?: number
}

interface S3ErrorShape {
  $metadata?: S3ErrorMetadata
  name?: string
}

/** Generic S3 store used by the R2 backend. */
export function createS3Store(config: S3StoreConfig): ObjectStore {
  const { bucket, client } = clientFor(config)

  return {
    id: 'r2',

    async head(key): Promise<ObjectInfo | null> {
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
        if (isNotFound(error)) {
          return null
        }

        throw error
      }
    },

    async put(params): Promise<ObjectInfo> {
      const { key, file, contentType, sha256, onProgress } = params
      const stats = await fs.stat(file)
      const isMultipart = stats.size > PART_SIZE
      const checksum: ChecksumFields = {}

      if (!isMultipart) {
        checksum.ChecksumSHA256 = sha256
      }

      const upload = new Upload({
        client,
        params: {
          Bucket: bucket,
          Key: key,
          Body: createReadStream(file),
          ContentType: contentType,
          ContentLength: stats.size,
          ChecksumAlgorithm: 'SHA256',
          ...checksum,
        },
        partSize: PART_SIZE,
        queueSize: 2,
      })

      upload.on('httpUploadProgress', ({ loaded, total }) => {
        onProgress?.(loaded ?? 0, total ?? stats.size)
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

    /** Writes, reads and deletes a 4-byte probe. Returns the S3 error code on failure. */
    async testConnection(): Promise<TestResult> {
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
    },
  }
}

function clientFor(config: S3StoreConfig): S3ClientBundle {
  const { endpoint, region, bucket, accessKeyId, secretAccessKey } = config

  return {
    bucket,
    client: new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    }),
  }
}

function s3ErrorCode(error: unknown): string {
  if (isObject(error)) {
    const name = (error as ErrorWithName).name

    if (isString(name) && name !== '') {
      return name
    }
  }

  return 'R2 test failed'
}

function isNotFound(error: unknown): boolean {
  if (!isObject(error)) {
    return false
  }

  const err = error as S3ErrorShape

  return (
    err.$metadata?.httpStatusCode === 404 || err.name === 'NotFound' || err.name === 'NoSuchKey'
  )
}
