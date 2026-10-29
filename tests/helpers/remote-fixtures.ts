import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'

import { isNil } from 'lodash-es'

import type { UploadItem } from '@/core/schemas/upload-item'
import type {
  ListedObject,
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
  readonly listed = new Map<string, ListedObject>()
  readonly deleted: string[] = []
  readonly puts: string[] = []
  private readonly lastModified = new Map<string, number>()
  listCalls = 0
  headCalls = 0

  async head(key: string): Promise<ObjectInfo | null> {
    this.headCalls += 1
    const info = this.objects.get(key)

    if (isNil(info)) {
      return null
    }

    return { ...info, lastModified: this.lastModified.get(key) ?? Date.now() }
  }

  async put(params: PutObjectParams): Promise<ObjectInfo> {
    const { key, file, sha256 } = params
    const stats = await fs.stat(file)
    const lastModified = Date.now()
    const info = { key, size: stats.size, serverSha256: sha256, lastModified }

    this.puts.push(key)
    this.objects.set(key, info)
    this.lastModified.set(key, lastModified)
    this.listed.set(key, { key, size: stats.size, lastModified })

    return info
  }

  async presign(params: PresignParams): Promise<string> {
    return `mock://${params.key}`
  }

  async *list(prefix: string): AsyncIterable<ListedObject> {
    this.listCalls += 1

    for (const object of this.listed.values()) {
      if (object.key.startsWith(prefix)) {
        yield object
      }
    }
  }

  seed(object: ListedObject): void {
    this.listed.set(object.key, object)
  }

  setLastModified(key: string, lastModified: number): void {
    this.lastModified.set(key, lastModified)
  }

  markDeleted(key: string): void {
    this.objects.delete(key)
    this.listed.delete(key)
    this.lastModified.delete(key)
  }

  async delete(key: string): Promise<void> {
    this.deleted.push(key)
    this.objects.delete(key)
    this.listed.delete(key)
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
