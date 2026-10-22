import { isNil } from 'lodash-es'

import { type RefSlot, slotLabel } from '@/core/prompt-tokens'
import type { ReferencePlan, UploadItem } from '@/core/types'

export type PlannedImage = ReferencePlan['images'][number]

interface NoteForParams {
  id: string
  planned: Record<string, PlannedImage>
}

/** Downscale note for an attached image, if the plan has one. */
export function noteFor(params: NoteForParams): string | undefined {
  const { id, planned } = params
  const image = planned[id]

  if (isNil(image)) return undefined

  const size = `Sent at ${image.width}x${image.height}`

  if (isNil(image.flattened)) return size

  return `${size} \u00b7 Transparent, sent on ${image.flattened === '#ffffff' ? 'white' : 'dark'}`
}

/** Slot label for an attached reference. */
export function labelFor(slots: Map<string, RefSlot>, id: string): string | undefined {
  const slot = slots.get(id)

  return slot ? slotLabel(slot) : undefined
}

/** Uploads for the attached references, in order. */
export function referenceUploads(
  references: string[],
  uploadsById: Record<string, UploadItem>,
): UploadItem[] {
  return references.flatMap((id) => {
    const upload = uploadsById[id]

    if (isNil(upload)) return []

    return [upload]
  })
}
