import { isNil, isString } from 'lodash-es'

import { folderFileUpload } from '@/core/folder-match'
import type { MediaKindCounts } from '@/core/media-types'
import { getPreset } from '@/core/presets'
import type { ModelPreset } from '@/core/presets/types'
import { referenceSlots, type RefSlot, slotToken } from '@/core/prompt-tokens'
import type { GenerationRecord, GeneratorTab } from '@/core/schemas/generation-record'
import type { UploadItem, UploadsById } from '@/core/schemas/upload-item'

import { addBlockReason, referenceRoom } from './reference-rules'

interface UploadMediaTarget {
  kind: 'upload'
  upload: UploadItem
}

interface RecordMediaTarget {
  kind: 'record'
  record: GenerationRecord
}

export type MediaTarget = UploadMediaTarget | RecordMediaTarget

interface MediaFrames {
  start: string | null
  end: string | null
}

export interface MediaUseState {
  tab: GeneratorTab
  presetId: string
  references: string[]
  frames: MediaFrames
  uploadsById: UploadsById
}

export interface MediaUse {
  label: string
  isDisabled: boolean
  reason: string
}

interface UseContext {
  label: string
  preset: ModelPreset
  room: MediaKindCounts
  slots: Map<string, RefSlot>
  state: MediaUseState
}

function enabled(label: string): MediaUse {
  return { label, isDisabled: false, reason: label }
}

function disabled(label: string, reason: string): MediaUse {
  return { label, isDisabled: true, reason }
}

function referenceRecordUse(context: UseContext): MediaUse {
  const { label, preset, room } = context
  const reason = addBlockReason({ kind: 'video', room, preset })

  if (!isNil(reason)) {
    return disabled(label, reason)
  }

  return enabled(label)
}

function referenceUploadUse(context: UseContext, upload: UploadItem): MediaUse {
  const { label, preset, room, slots, state } = context
  const slot = slots.get(upload.id)

  if (state.references.includes(upload.id)) {
    if (isNil(slot)) {
      return disabled(label, label)
    }

    return disabled(label, `Already ${slotToken(slot)}`)
  }

  const reason = addBlockReason({ kind: upload.kind, room, preset })

  if (!isNil(reason)) {
    return disabled(label, reason)
  }

  return enabled(label)
}

function frameRecordUse(context: UseContext): MediaUse {
  const { label, preset } = context

  if (!preset.frames.start) {
    return disabled(label, 'This model does not take a start frame')
  }

  return enabled(label)
}

function frameUploadUse(context: UseContext, upload: UploadItem): MediaUse {
  const { label, preset, state } = context

  if (upload.kind !== 'image') {
    return disabled(label, 'Start frame takes an image')
  }

  if (state.frames.start === upload.id) {
    return disabled(label, 'Already the start frame')
  }

  if (!preset.frames.start) {
    return disabled(label, 'This model does not take a start frame')
  }

  return enabled(label)
}

/**
 * Use-button state for a media target in the active generator mode.
 * Pure: the same target and state always give the same label and reason.
 */
export function mediaUse(target: MediaTarget, state: MediaUseState): MediaUse {
  const label = state.tab === 'frames' ? 'Start frame' : 'Reference'
  const preset = getPreset(state.presetId)

  const room = referenceRoom({
    preset,
    references: state.references,
    uploadsById: state.uploadsById,
  })

  const slots = referenceSlots(state.references, (id) => {
    return state.uploadsById[id]?.kind
  }).slots

  const context: UseContext = { label, preset, room, slots, state }

  if (target.kind === 'record') {
    if (state.tab === 'references') {
      return referenceRecordUse(context)
    }

    return frameRecordUse(context)
  }

  const upload = attachedFolderUpload(target.upload, state) ?? target.upload

  if (state.tab === 'references') {
    return referenceUploadUse(context, upload)
  }

  return frameUploadUse(context, upload)
}

interface FolderRef {
  folderId: string
  relPath: string
}

/** Read-only folder ref, present only on picker items that are still unlinked. */
function folderPreviewRef(upload: UploadItem): string | null {
  if (!('previewRef' in upload)) {
    return null
  }

  const ref = upload.previewRef

  if (!isString(ref)) {
    return null
  }

  return ref
}

/** `folders/<folderId>/<relPath>` to its two parts, null for any other shape. */
function folderRef(ref: string): FolderRef | null {
  const rest = ref.slice('folders/'.length)
  const slash = rest.indexOf('/')

  if (slash <= 0 || slash === rest.length - 1) {
    return null
  }

  return { folderId: rest.slice(0, slash), relPath: rest.slice(slash + 1) }
}

/** Folder ref of an unlinked folder preview, null for any other upload. */
export function folderTargetFromUpload(upload: UploadItem): FolderRef | null {
  const ref = folderPreviewRef(upload)

  if (isNil(ref) || !ref.startsWith('folders/')) {
    return null
  }

  return folderRef(ref)
}

interface FolderAttachmentState {
  references: string[]
  frames: MediaFrames
  uploadsById: UploadsById
}

/** Attached upload already linked to the folder preview target, null when none. */
export function attachedFolderUpload(
  upload: UploadItem,
  state: FolderAttachmentState,
): UploadItem | null {
  const folder = folderTargetFromUpload(upload)

  if (isNil(folder) || !('folderPath' in upload) || !isString(upload.folderPath)) {
    return null
  }

  let selectedIds = state.references
  const startFrame = state.frames.start

  if (!isNil(startFrame)) {
    selectedIds = [...selectedIds, startFrame]
  }

  return folderFileUpload({
    folderPath: upload.folderPath,
    rel: folder.relPath,
    selectedIds,
    uploadsById: state.uploadsById,
  })
}
