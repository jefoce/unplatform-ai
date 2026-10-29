import 'server-only'

import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  type ListObjectsV2CommandOutput,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { isNil, isObject, isString } from 'lodash-es'

import type { TestResult } from '@/core/types'

import type { ListedObject, ObjectInfo, ObjectStore } from './types'

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
          lastModified: res.LastModified?.getTime() ?? 0,
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

      return {
        key,
        size: stats.size,
        serverSha256: res.ChecksumSHA256 ?? null,
        lastModified: Date.now(),
      }
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

    list(prefix: string): AsyncIterable<ListedObject> {
      return listObjects({ client, bucket, prefix })
    },

    testConnection(): Promise<TestResult> {
      return probeBucket(client, bucket)
    },
  }
}

/** Writes, reads and deletes a 4-byte probe. Returns the S3 error code on failure. */
async function probeBucket(client: S3Client, bucket: string): Promise<TestResult> {
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

interface ListObjectsParams {
  client: S3Client
  bucket: string
  prefix: string
}

interface S3ObjectEntry {
  Key?: string
  Size?: number
  LastModified?: Date
}

async function* listObjects(params: ListObjectsParams): AsyncIterable<ListedObject> {
  const { client, bucket, prefix } = params
  let token: string | null = null

  do {
    const res: ListObjectsV2CommandOutput = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 1000,
        ContinuationToken: token ?? undefined,
      }),
    )

    for (const entry of res.Contents ?? []) {
      const object = listedFrom(entry)

      if (isNil(object)) {
        continue
      }

      yield object
    }

    token = null

    if (res.IsTruncated === true) {
      token = res.NextContinuationToken ?? null
    }
  } while (!isNil(token))
}

function listedFrom(entry: S3ObjectEntry): ListedObject | null {
  if (isNil(entry.Key)) {
    return null
  }

  return {
    key: entry.Key,
    size: entry.Size ?? 0,
    lastModified: entry.LastModified?.getTime() ?? 0,
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
