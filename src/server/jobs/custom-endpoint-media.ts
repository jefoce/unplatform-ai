import 'server-only'

import type { UploadItem } from '@/core/schemas/upload-item'
import type { Dict } from '@/core/utility-types'

import { isCustomEndpointMockMode } from '../config/mock-mode'
import { uploadPaths } from '../paths'
import { secretsReady } from '../secrets'
import { hashFile } from '../storage/hash'
import {
  checkUploadSize,
  ensureUploadRef,
  loadEndpointHealth,
  loadUploadTarget,
  uploadRef,
} from './custom-endpoint-upload'

interface CustomRefsParams {
  instanceId: string | null
  uploads: UploadItem[]
  signal?: AbortSignal
}

interface HashedUpload {
  upload: UploadItem
  sha256: string
  size: number
}

/** Uploads video and audio refs to the endpoint, keyed by upload id. */
export async function uploadCustomRefs(params: CustomRefsParams): Promise<Dict<string>> {
  const { instanceId, uploads, signal } = params

  if (uploads.length === 0) {
    return {}
  }

  const hashed = await Promise.all(uploads.map(hashUpload))

  if (isCustomEndpointMockMode()) {
    return refsFor(hashed, new Map())
  }

  await secretsReady()
  const endpoint = await loadUploadTarget(instanceId)
  const health = await loadEndpointHealth({ endpoint, signal })
  const unique = uniqueBySha(hashed)

  for (const item of unique) {
    checkUploadSize({ size: item.size, maxBytes: health.max_upload_bytes })
  }

  const refBySha = new Map<string, string>()

  for (const item of unique) {
    signal?.throwIfAborted()

    const ref = await ensureUploadRef({
      endpoint,
      upload: item.upload,
      sha256: item.sha256,
      signal,
    })

    refBySha.set(item.sha256, ref)
  }

  return refsFor(hashed, refBySha)
}

function refsFor(hashed: HashedUpload[], refBySha: Map<string, string>): Dict<string> {
  return Object.fromEntries(
    hashed.map(({ upload, sha256 }) => {
      return [upload.id, refBySha.get(sha256) ?? uploadRef(sha256)]
    }),
  )
}

/** One HEAD and POST per distinct file, even when two slots share bytes. */
function uniqueBySha(hashed: HashedUpload[]): HashedUpload[] {
  const seen = new Set<string>()

  return hashed.filter((item) => {
    if (seen.has(item.sha256)) {
      return false
    }

    seen.add(item.sha256)

    return true
  })
}

async function hashUpload(upload: UploadItem): Promise<HashedUpload> {
  const { media } = uploadPaths(upload.id, upload.ext)
  const digest = await hashFile(media)

  return { upload, sha256: digest.sha256Hex, size: digest.size }
}
