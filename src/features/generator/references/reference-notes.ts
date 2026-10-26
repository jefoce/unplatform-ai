import { isNil } from 'lodash-es'

import type { ReferencePlanImage } from '@/core/media-types'
import { type RefSlot, slotLabel } from '@/core/prompt-tokens'
import type { UploadItem, UploadsById } from '@/core/schemas/upload-item'
import type { Dict } from '@/core/utility-types'

interface NoteForParams {
  id: string
  planned: Dict<ReferencePlanImage>
}

/** Downscale note for an attached image, if the plan has one. */
export function noteFor(params: NoteForParams): string | undefined {
  const { id, planned } = params
  const image = planned[id]

  if (isNil(image)) {
    return undefined
  }

  const size = `Sent at ${image.width}x${image.height}`

  if (isNil(image.flattened)) {
    return size
  }

  const background = image.flattened === '#ffffff' ? 'white' : 'dark'

  return `${size} \u00b7 Transparent, sent on ${background}`
}

/** Slot label for an attached reference. */
export function labelFor(slots: Map<string, RefSlot>, id: string): string | undefined {
  const slot = slots.get(id)

  if (slot) {
    return slotLabel(slot)
  }

  return undefined
}

/** Uploads for the attached references, in order. */
export function referenceUploads(references: string[], uploadsById: UploadsById): UploadItem[] {
  return references.flatMap((id) => {
    const upload = uploadsById[id]

    if (isNil(upload)) {
      return []
    }

    return [upload]
  })
}
