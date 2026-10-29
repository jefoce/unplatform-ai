import 'server-only'

import type { StorageProviderId } from '@/core/providers/types'
import type { TestResult } from '@/core/types'

export type ProgressCallback = (sent: number, total: number) => void

export interface ObjectInfo {
  key: string
  size: number
  serverSha256: string | null
  lastModified: number
}

export interface ListedObject {
  key: string
  size: number
  lastModified: number
}

export interface PutObjectParams {
  key: string
  file: string
  contentType: string
  sha256: string
  onProgress: ProgressCallback | null
}

export interface PresignParams {
  key: string
  ttlSec: number
  contentType: string
}

export interface ObjectStore {
  readonly id: StorageProviderId
  head(key: string): Promise<ObjectInfo | null>
  put(params: PutObjectParams): Promise<ObjectInfo>
  presign(params: PresignParams): Promise<string>
  delete(key: string): Promise<void>
  testConnection(): Promise<TestResult>
  list?(prefix: string): AsyncIterable<ListedObject>
}
