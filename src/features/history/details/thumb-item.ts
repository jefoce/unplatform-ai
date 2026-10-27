import { isNil, keyBy } from 'lodash-es'
import { toast } from 'sonner'

import { isNonEmptyString } from '@/core/guards'
import { referenceSlots, slotLabel } from '@/core/prompt-tokens'
import type {
  GenerationRecord,
  InputSnapshot,
  SnapshotItem,
} from '@/core/schemas/generation-record'
import type { UploadItem } from '@/core/schemas/upload-item'
import { openPreview } from '@/features/preview/preview-store'
import { fetchUploads } from '@/lib/api/uploads'
import { formatBytes } from '@/lib/format'
import { toastError } from '@/lib/notify'

export interface ThumbItem {
  id: string
  label: string
  name: string
  missing: boolean
  sent?: string
}

const isFilled = (value: string | null | undefined): value is string => {
  return isNonEmptyString(value)
}

function sentNote(item: SnapshotItem | undefined): string | undefined {
  if (isNil(item)) {
    return undefined
  }

  const { sentWidth, sentHeight, sentBytes, format } = item

  if (isNil(sentWidth) || sentWidth === 0) {
    return undefined
  }

  if (isNil(sentHeight) || sentHeight === 0) {
    return undefined
  }

  if (isNil(sentBytes)) {
    return undefined
  }

  let formatLabel = 'image'

  if (!isNil(format)) {
    formatLabel = format.toUpperCase()
  }

  return `Sent as ${formatLabel} ${sentWidth}x${sentHeight}, ${formatBytes(sentBytes)}`
}

interface ThumbItemParams {
  snapshot: InputSnapshot
  id: string
  label: string
}

function thumbItem(params: ThumbItemParams): ThumbItem {
  const { snapshot, id, label } = params
  const item = snapshot[id]

  return {
    id,
    label,
    name: item?.originalName ?? 'Deleted upload',
    missing: isNil(item),
    sent: sentNote(item),
  }
}

/** Start/end frame and reference thumbs for a record input, in display order. */
export function thumbItems(record: GenerationRecord): ThumbItem[] {
  const { tab, frames, references } = record.input
  const snapshot = record.inputsSnapshot
  const items: ThumbItem[] = []

  if (tab === 'frames') {
    for (const [label, id] of [
      ['Start frame', frames.start],
      ['End frame', frames.end],
    ] as const) {
      if (isFilled(id)) {
        items.push(thumbItem({ snapshot, id, label }))
      }
    }
  }

  if (tab === 'references') {
    const { slots } = referenceSlots(references, (id) => {
      return snapshot[id]?.kind
    })

    for (const id of references) {
      const slot = slots.get(id)
      let label = 'Reference'

      if (!isNil(slot)) {
        label = slotLabel(slot)
      }

      items.push(thumbItem({ snapshot, id, label }))
    }
  }

  return items
}

export interface OpenThumbParams {
  item: ThumbItem
  items: ThumbItem[]
  index: number
}

/** Opens the uploads behind a thumb chain, toasting when the clicked file is gone. */
export async function openThumb(params: OpenThumbParams): Promise<void> {
  const { item, items, index } = params

  if (item.missing) {
    toast.error('File no longer exists')

    return
  }

  try {
    const uploads = await fetchUploads({
      ids: items.map((entry) => {
        return entry.id
      }),
    })

    const byId = keyBy(uploads, 'id')
    const current = byId[item.id]

    if (isNil(current) || current.missing === true) {
      toast.error('File no longer exists')

      return
    }

    const chain: UploadItem[] = []
    let chainIndex = -1

    for (const [position, entry] of items.entries()) {
      const upload = byId[entry.id]

      if (isNil(upload) || upload.missing === true) {
        continue
      }

      if (position === index) {
        chainIndex = chain.length
      }

      chain.push(upload)
    }

    openPreview({ items: chain, index: chainIndex })
  } catch (error) {
    toastError(error)
  }
}
