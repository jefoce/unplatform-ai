import { isNil } from 'lodash-es'
import { toast } from 'sonner'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { UploadItem } from '@/core/schemas/upload-item'
import { linkFolderFile } from '@/lib/api/uploads'
import { toastError } from '@/lib/notify'

import { attachedFolderUpload, folderTargetFromUpload, type MediaTarget } from './media-rules'
import { applyRecordToGenerator } from './record-input'
import { useGeneratorStore } from './store/store'

async function linkedUpload(upload: UploadItem): Promise<UploadItem | null> {
  const folder = folderTargetFromUpload(upload)

  if (isNil(folder)) {
    return upload
  }

  try {
    return await linkFolderFile(folder)
  } catch (error) {
    toastError(error)

    return null
  }
}

async function applyRecord(record: GenerationRecord): Promise<boolean> {
  const isFrames = useGeneratorStore.getState().tab === 'frames'

  try {
    const isApplied = await applyRecordToGenerator(record)

    if (!isApplied) {
      toast.error('Reference limit reached')

      return false
    }

    const message = isFrames ? 'Start frame set' : 'Added as reference'

    toast.success(message)

    return true
  } catch (error) {
    toastError(error)

    return false
  }
}

function applyUploadFrame(upload: UploadItem): boolean {
  if (upload.kind !== 'image') {
    return false
  }

  useGeneratorStore.getState().setFrame('start', upload)
  toast.success('Start frame set')

  return true
}

function applyUploadReference(upload: UploadItem): boolean {
  const store = useGeneratorStore.getState()

  if (store.references.includes(upload.id)) {
    toast.error('Already attached')

    return false
  }

  store.addReferences([upload])

  const isAdded = useGeneratorStore.getState().references.includes(upload.id)

  if (isAdded) {
    toast.success('Added as reference')

    return true
  }

  toast.error('Reference limit reached')

  return false
}

/**
 * Applies a target to the current generator tab, linking folder files first.
 * Reads the live store, so callers never pass stale draft state.
 */
export async function applyMedia(target: MediaTarget): Promise<boolean> {
  if (target.kind === 'record') {
    return applyRecord(target.record)
  }

  const attached = attachedFolderUpload(target.upload, useGeneratorStore.getState())
  const upload = attached ?? (await linkedUpload(target.upload))

  if (isNil(upload)) {
    return false
  }

  if (useGeneratorStore.getState().tab === 'frames') {
    return applyUploadFrame(upload)
  }

  return applyUploadReference(upload)
}
