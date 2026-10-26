import { randomUUID } from 'node:crypto'

import type { UploadItem } from '@/core/schemas/upload-item'
import type {
  ObjectInfo,
  ObjectStore,
  PresignParams,
  PutObjectParams,
} from '@/server/storage/types'

export const GIB = 1024 ** 3

export interface RecordParams {
  key: string
  size: number
  lastUsedAt: string
}

export class FakeStore implements ObjectStore {
  readonly id = 'r2'
  readonly objects = new Map<string, ObjectInfo>()
  readonly deleted: string[] = []

  async head(key: string): Promise<ObjectInfo | null> {
    return this.objects.get(key) ?? null
  }

  async put(params: PutObjectParams): Promise<ObjectInfo> {
    const { key, sha256 } = params
    const info = { key, size: 1, serverSha256: sha256 }

    this.objects.set(key, info)

    return info
  }

  async presign(params: PresignParams): Promise<string> {
    return `mock://${params.key}`
  }

  async delete(key: string): Promise<void> {
    this.deleted.push(key)
    this.objects.delete(key)
  }

  async testConnection(): Promise<{ ok: boolean }> {
    return { ok: true }
  }
}

export function remoteUpload(params: RecordParams): UploadItem {
  const { key, size, lastUsedAt } = params
  const id = randomUUID()

  return {
    id,
    source: 'file',
    kind: 'image',
    mime: 'image/png',
    ext: '.png',
    originalName: 'fixture.png',
    sizeBytes: size,
    createdAt: lastUsedAt,
    remote: {
      key,
      sha256: id,
      serverSha256: id,
      size,
      mtimeMs: 1,
      uploadedAt: lastUsedAt,
      lastUsedAt,
    },
  }
}

export function uploadWith(key: string, size: number): UploadItem {
  return remoteUpload({ key, size, lastUsedAt: daysAgo(1) })
}

export function plainUpload(): UploadItem {
  return {
    id: randomUUID(),
    source: 'file',
    kind: 'image',
    mime: 'image/png',
    ext: '.png',
    originalName: 'fixture.png',
    sizeBytes: 99,
    createdAt: daysAgo(1),
  }
}

export function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

export function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString()
}
