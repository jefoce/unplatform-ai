import { isEmpty, isNil, uniqBy } from 'lodash-es'
import { toast } from 'sonner'
import { mutate } from 'swr'

import { isNonEmptyString } from '@/core/guards'
import { acceptFiles, type KindExtensions } from '@/core/media-kinds'
import { MEDIA_KINDS, type MediaKind } from '@/core/media-types'
import { getPreset } from '@/core/presets'
import { referenceSlots } from '@/core/prompt-tokens'
import type { UploadItem } from '@/core/schemas/upload-item'
import { addBlockReason, referenceRoom } from '@/features/generator/reference-rules'
import { useGeneratorStore } from '@/features/generator/store/store'
import {
  closeMediaPicker,
  extensionsFromLimits,
  type PickerRequest,
  type PickerToggleMode,
  useMediaPickerStore,
} from '@/features/media-picker/picker/store'
import { uploadFiles } from '@/lib/api/uploads'
import { toastError } from '@/lib/notify'

import { linkDroppedPaths } from './link-dropped'

/** Adds the references that fit, reporting every new upload that did not. */
function addToReferences(items: UploadItem[]): void {
  const state = useGeneratorStore.getState()
  const preset = getPreset(state.presetId)
  const before = state.references
  const room = referenceRoom({ preset, references: before, uploadsById: state.uploadsById })

  const offered = uniqBy(items, 'id').filter((item) => {
    return !before.includes(item.id)
  })

  let reason: string | null = null

  for (const item of offered) {
    const blocked = addBlockReason({ kind: item.kind, room, preset })

    if (!isNil(blocked)) {
      reason ??= blocked

      continue
    }

    room[item.kind] -= 1
  }

  state.addReferences(items)

  const added = useGeneratorStore.getState().references.length - before.length
  const missing = offered.length - added

  if (missing > 0 && !isNil(reason)) {
    reportSkipped({ count: missing, reason })
  }
}

/** Attaches uploads to the active tab. */
function route(items: UploadItem[]): void {
  const state = useGeneratorStore.getState()

  if (state.tab === 'references') {
    addToReferences(items)

    return
  }

  const preset = getPreset(state.presetId)
  let slot: 'start' | 'end' = 'start'

  const hasStart = isNonEmptyString(state.frames.start)
  const hasEnd = isNonEmptyString(state.frames.end)

  if (hasStart && preset.frames.end && !hasEnd) {
    slot = 'end'
  }

  const image = items.find((item) => {
    return item.kind === 'image'
  })

  if (!image) {
    toast.error('Frames need an image')

    return
  }

  state.setFrame(slot, image)
}

/** Kinds the active tab can still take. */
function allowedKinds(): MediaKind[] {
  const state = useGeneratorStore.getState()

  if (state.tab !== 'references') {
    return ['image']
  }

  const preset = getPreset(state.presetId)

  const { counts } = referenceSlots(state.references, (id) => {
    return state.uploadsById[id]?.kind
  })

  return MEDIA_KINDS.filter((kind) => {
    return counts[kind] < preset.references[kind]
  })
}

/** Preset formats for the active model. */
function allowedExtensions(): KindExtensions | undefined {
  return extensionsFromLimits(getPreset(useGeneratorStore.getState().presetId).referenceLimits)
}

interface SkipReport {
  count: number
  reason: string
}

/** One toast for every file the target refused. */
function reportSkipped(report: SkipReport): void {
  const { count, reason } = report
  const suffix = count === 1 ? '' : 's'

  toast(`Skipped ${count} file${suffix} (${reason})`)
}

function revalidateUploads(): void {
  void mutate(
    (key) => {
      return Array.isArray(key) && key[0] === 'uploads'
    },
    undefined,
    { revalidate: true },
  )
}

interface AddResult {
  skipped: number
  reason: string | null
}

/** Adds each new upload once, leaving attached ids alone without counting them. */
function applyAdd(mode: PickerToggleMode, items: UploadItem[]): AddResult {
  const unique = uniqBy(items, 'id')
  const selected = mode.useSelectedIds()
  let skipped = 0
  let reason: string | null = null

  for (const item of unique) {
    if (selected.includes(item.id)) {
      continue
    }

    const blocked = mode.canAdd(item)

    if (!isNil(blocked)) {
      skipped += 1
      reason ??= blocked

      continue
    }

    mode.onAdd(item)
  }

  return { skipped, reason }
}

function pickFirst(request: PickerRequest, items: UploadItem[]): void {
  const [first] = items

  if (isNil(first) || request.mode.kind !== 'pick') {
    return
  }

  request.mode.onPick(first)
  closeMediaPicker()
}

/** Routes uploads into the open picker request instead of the generator tab. */
export function routeUploads(items: UploadItem[]): void {
  const request = useMediaPickerStore.getState().request

  if (isNil(request)) {
    route(items)

    return
  }

  if (request.mode.kind === 'pick') {
    pickFirst(request, items)

    return
  }

  const added = applyAdd(request.mode, items)

  revalidateUploads()

  if (added.skipped > 0) {
    reportSkipped({ count: added.skipped, reason: added.reason ?? 'unsupported file' })
  }
}

interface IngestTarget {
  isPicker: boolean
  kinds: readonly MediaKind[]
  extensions: KindExtensions | undefined
}

/** Format filters of the open picker, else of the active tab. */
function ingestTarget(): IngestTarget {
  const request = useMediaPickerStore.getState().request

  if (isNil(request)) {
    return { isPicker: false, kinds: allowedKinds(), extensions: allowedExtensions() }
  }

  return { isPicker: true, kinds: request.kinds, extensions: request.extensions }
}

/** Filters by the open picker or active tab, uploads the accepted files and routes the result. */
export async function routeFiles(files: File[]): Promise<void> {
  const { isPicker, kinds, extensions } = ingestTarget()

  const { accepted, skipped } = acceptFiles({ files, kinds, extensions })

  if (isPicker && skipped > 0) {
    reportSkipped({ count: skipped, reason: 'unsupported file' })
  } else if (skipped > 0) {
    const suffix = skipped === 1 ? '' : 's'

    toast(`Skipped ${skipped} unsupported file${suffix}`)
  }

  if (isEmpty(accepted)) {
    return
  }

  try {
    const items = await uploadFiles(accepted)

    routeUploads(items)
  } catch (error) {
    toastError(error)
  }
}

/** Links dropped desktop paths into the open picker or the active tab. */
export async function ingestDroppedPaths(paths: string[]): Promise<void> {
  const { kinds, extensions } = ingestTarget()

  try {
    const items = await linkDroppedPaths({ paths, kinds, extensions })

    routeUploads(items)
  } catch (error) {
    toastError(error)
  }
}
