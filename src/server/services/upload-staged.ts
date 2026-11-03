import 'server-only'

import { extWithDot } from '@/core/media/media-kinds'
import type { UploadItem } from '@/core/schemas/upload-item'

import { removeFile } from '../fs/json-file'
import { saveStagedUpload } from '../repos/uploads'
import { hashFile } from '../storage/hash'
import { matchByHash, rememberUpload, runWithHashLock } from './upload-hash'
import { assertSupported, probe } from './upload-probe'

interface CreateStagedUploadParams {
  temp: string
  originalName: string
}

/** Hashes and probes a fully-written temp file, then moves it into uploads/. */
export async function createStagedUpload(params: CreateStagedUploadParams): Promise<UploadItem> {
  const { temp, originalName } = params
  const ext = extWithDot(originalName)
  const kind = assertSupported(ext)
  const digest = await hashFile(temp)

  return runWithHashLock(digest.size, async () => {
    const existing = await matchByHash({ sha256: digest.sha256Hex, size: digest.size })

    if (existing) {
      await removeFile(temp)

      return existing
    }

    const meta = await probe(temp, kind)

    const item = await saveStagedUpload({
      temp,
      originalName,
      sha256: digest.sha256Hex,
      sizeBytes: digest.size,
      ...meta,
    })

    rememberUpload({ id: item.id, size: digest.size })

    return item
  })
}
