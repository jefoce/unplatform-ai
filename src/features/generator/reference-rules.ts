import { MEDIA_KINDS, type MediaKind, type MediaKindCounts } from '@/core/media-types'
import type { ModelPreset } from '@/core/presets/types'
import type { UploadsById } from '@/core/schemas/upload-item'

import { slotCounts } from './store/store-helpers'

interface ReferenceRoomParams {
  preset: ModelPreset
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

interface AddBlockReasonParams {
  kind: MediaKind
  room: MediaKindCounts
  preset: ModelPreset
}

/** Why a kind cannot be added, null when it has room. */
export function addBlockReason(params: AddBlockReasonParams): string | null {
  const { kind, room, preset } = params

  if (preset.references[kind] === 0) {
    return `This model does not take ${kind} references`
  }

  if (room[kind] <= 0) {
    return 'Reference limit reached'
  }

  return null
}
