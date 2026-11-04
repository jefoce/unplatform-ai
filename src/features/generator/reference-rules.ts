import type { UploadsById } from '@/core/api/uploads'
import { MEDIA_KINDS, type MediaKind, type MediaKindCounts } from '@/core/media/media-types'
import type { VideoPreset } from '@/core/presets/video/types'

import { slotCounts } from './store/store-helpers'

export const REFERENCE_ONLY_IMAGES = 'Only images can be references'
export const REFERENCE_ALREADY_ATTACHED = 'Already attached'
export const REFERENCE_LIMIT_REACHED = 'Reference limit reached'

interface ReferenceRoomParams {
  preset: VideoPreset
  references: string[]
  uploadsById: UploadsById
}

/** Free reference slots per kind for the current attachments. */
export function referenceRoom(params: ReferenceRoomParams): MediaKindCounts {
  const { preset, references, uploadsById } = params
  const counts = slotCounts({ references, uploadsById })
  const room: MediaKindCounts = { image: 0, video: 0, audio: 0 }

  for (const kind of MEDIA_KINDS) {
    room[kind] = Math.max(0, preset.references[kind] - counts[kind])
  }

  return room
}

function referenceNotTaken(kind: MediaKind): string {
  return `This model does not take ${kind} references`
}

interface ReferenceBlockReasonParams {
  kind: MediaKind
  max: number
  room: number
  isAttached?: boolean
  isImageOnly?: boolean
}

/** Why one reference cannot be added, null when it has room. */
export function referenceBlockReason(params: ReferenceBlockReasonParams): string | null {
  const { kind, max, room, isAttached = false, isImageOnly = false } = params

  if (max === 0) {
    if (isImageOnly) {
      return REFERENCE_ONLY_IMAGES
    }

    return referenceNotTaken(kind)
  }

  if (isAttached) {
    return REFERENCE_ALREADY_ATTACHED
  }

  if (room <= 0) {
    return REFERENCE_LIMIT_REACHED
  }

  return null
}

interface AddBlockReasonParams {
  kind: MediaKind
  room: MediaKindCounts
  preset: VideoPreset
}

/** Video-preset wrapper over referenceBlockReason, kept for the file router. */
export function addBlockReason(params: AddBlockReasonParams): string | null {
  const { kind, room, preset } = params

  return referenceBlockReason({
    kind,
    max: preset.references[kind],
    room: room[kind],
  })
}
