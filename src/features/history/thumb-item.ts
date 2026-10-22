import { isNil } from 'lodash-es'
import { toast } from 'sonner'

import { referenceSlots, slotLabel } from '@/core/prompt-tokens'
import type { GenerationRecord, UploadItem } from '@/core/types'
import { useGeneratorStore } from '@/features/generator/store'
import { fetchUploads } from '@/features/media-picker/api'
import { openPreview, type PreviewActions } from '@/features/preview/preview-store'
import { errorMessage } from '@/lib/errors'
import { formatBytes } from '@/lib/format'

export interface ThumbItem {
  id: string
  label: string
  name: string
  missing: boolean
  sent?: string
}

type InputSnapshot = GenerationRecord['inputsSnapshot']

const isFilled = (value: string | null | undefined): value is string =>
  !isNil(value) && value !== ''

function sentNote(item: InputSnapshot[string] | undefined): string | undefined {
  if (isNil(item)) return undefined

  const { sentWidth, sentHeight, sentBytes, format } = item

  if (isNil(sentWidth) || sentWidth === 0) return undefined
  if (isNil(sentHeight) || sentHeight === 0) return undefined
  if (isNil(sentBytes)) return undefined

  const formatLabel = isNil(format) ? 'image' : format.toUpperCase()

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
      if (isFilled(id)) items.push(thumbItem({ snapshot, id, label }))
    }
  }

  if (tab === 'references') {
    const { slots } = referenceSlots(references, (id) => snapshot[id]?.kind)

    for (const id of references) {
      const slot = slots.get(id)

      items.push(thumbItem({ snapshot, id, label: slot ? slotLabel(slot) : 'Reference' }))
    }
  }

  return items
}

function handleUseAsStart(current: UploadItem): void {
  const store = useGeneratorStore.getState()

  store.setTab('frames')
  store.setFrame('start', current)
}

function handleAddAsReference(current: UploadItem): void {
  useGeneratorStore.getState().addReferences([current])
}

function availableActions(current: UploadItem): ('useAsStart' | 'addAsReference')[] {
  if (current.kind === 'image') return ['useAsStart', 'addAsReference']

  return ['addAsReference']
}

const THUMB_ACTIONS: PreviewActions = {
  useAsStart: handleUseAsStart,
  addAsReference: handleAddAsReference,
  available: availableActions,
}

/** Opens the upload behind a thumb, toasting when the file is gone. */
export async function openThumb(item: ThumbItem): Promise<void> {
  try {
    const [upload] = await fetchUploads({ ids: [item.id] })

    if (isNil(upload) || upload.missing === true) {
      toast.error('File no longer exists')

      return
    }

    openPreview({ items: [upload], index: 0, actions: THUMB_ACTIONS })
  } catch (error) {
    toast.error(errorMessage(error))
  }
}
