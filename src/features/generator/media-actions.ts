import { isNil } from 'lodash-es'
import { toast } from 'sonner'

import { getPreset } from '@/core/presets'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { UploadItem } from '@/core/schemas/upload-item'
import {
  REFERENCE_LIMIT_REACHED,
  referenceBlockReason,
  referenceRoom,
} from '@/features/generator/reference-rules'
import { imageCanAdd } from '@/features/image-generator/image-picker'
import { useImageGeneratorStore } from '@/features/image-generator/store'
import type { PickerOutputCandidate } from '@/features/media-picker/picker/store'
import { currentWorkspaceTab } from '@/features/shared/use-workspace-tab'
import { fetchGenerationsByIds } from '@/lib/api/generations'
import { createImageOutputUpload } from '@/lib/api/images'
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
      toast.error(REFERENCE_LIMIT_REACHED)

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
  const preset = getPreset(store.presetId)

  const room = referenceRoom({
    preset,
    references: store.references,
    uploadsById: store.uploadsById,
  })

  const reason = referenceBlockReason({
    kind: upload.kind,
    max: preset.references[upload.kind],
    room: room[upload.kind],
    isAttached: store.references.includes(upload.id),
  })

  if (!isNil(reason)) {
    toast.error(reason)

    return false
  }

  store.addReferences([upload])
  toast.success('Added as reference')

  return true
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

interface ImageOutputParams {
  recordId: string
  outputId: string
}

interface ImageOutputFrameParams extends ImageOutputParams {
  slot: 'start' | 'end'
}

async function imageOutputUpload(params: ImageOutputParams): Promise<UploadItem | null> {
  try {
    return await createImageOutputUpload(params)
  } catch (error) {
    toastError(error)

    return null
  }
}

/** Copies an image output into uploads and puts it in a frame slot. */
export async function applyImageOutputFrame(params: ImageOutputFrameParams): Promise<boolean> {
  const { slot, ...output } = params
  const upload = await imageOutputUpload(output)

  if (isNil(upload)) {
    return false
  }

  const store = useGeneratorStore.getState()

  if (store.tab !== 'frames') {
    store.setTab('frames')
  }

  store.setFrame(slot, upload)
  const message = slot === 'start' ? 'Start frame set' : 'End frame set'

  toast.success(message)

  return true
}

/** Adds a copied output to the image draft, reporting the rule that blocked it. */
function applyImageDraftReference(upload: UploadItem): boolean {
  const blocked = imageCanAdd(upload)

  if (!isNil(blocked)) {
    toast.error(blocked)

    return false
  }

  useImageGeneratorStore.getState().addReferences([upload])
  toast.success('Added as reference')

  return true
}

/** Copies an image output into uploads and adds it to the active workspace draft. */
export async function applyImageOutputReference(params: ImageOutputParams): Promise<boolean> {
  const upload = await imageOutputUpload(params)

  if (isNil(upload)) {
    return false
  }

  if (currentWorkspaceTab() === 'image') {
    return applyImageDraftReference(upload)
  }

  return applyUploadReference(upload)
}

type PickerOutputTarget = 'reference' | 'start' | 'end'

interface ApplyPickerOutputParams {
  candidate: PickerOutputCandidate
  target: PickerOutputTarget
}

/** Applies a picker generation tile to a reference or frame slot. */
export async function applyPickerOutput(params: ApplyPickerOutputParams): Promise<boolean> {
  const { candidate, target } = params

  if (candidate.recordKind === 'image') {
    if (isNil(candidate.outputId)) {
      return false
    }

    const output = { recordId: candidate.recordId, outputId: candidate.outputId }

    if (target === 'reference') {
      return applyImageOutputReference(output)
    }

    return applyImageOutputFrame({ ...output, slot: target })
  }

  const result = await fetchGenerationsByIds([candidate.recordId])
  const record = result.items.at(0)

  if (isNil(record)) {
    return false
  }

  return applyMedia({ kind: 'record', record })
}
