import 'server-only'

import type { InputSnapshot, SnapshotItem } from '@/core/schemas/generation-record'
import type { UploadItem } from '@/core/schemas/upload-item'

/** Snapshot fields copied from an upload into a record. */
export function snapshotItem(upload: UploadItem): SnapshotItem {
  return {
    kind: upload.kind,
    originalName: upload.originalName,
    source: upload.source,
    target: upload.target,
    width: upload.width,
    height: upload.height,
  }
}

/** Snapshot of every upload a record was created with. */
export function uploadsSnapshot(uploads: readonly UploadItem[]): InputSnapshot {
  return Object.fromEntries(
    uploads.map((upload) => {
      return [upload.id, snapshotItem(upload)]
    }),
  )
}
