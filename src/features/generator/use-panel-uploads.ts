'use client'

import { useEffect, useMemo } from 'react'
import { isNil } from 'lodash-es'
import { toast } from 'sonner'

import { MEDIA_KINDS } from '@/core/media-kinds'
import { getPreset } from '@/core/presets'
import { referenceSlots } from '@/core/prompt-tokens'
import type { MediaKind, UploadItem } from '@/core/types'
import { fetchUploads, uploadFiles } from '@/features/media-picker/api'
import { extensionsFromLimits, type PickerExtensions } from '@/features/media-picker/store'
import { usePasteMedia } from '@/features/media-picker/use-paste-media'
import { errorMessage } from '@/lib/errors'

import { useGeneratorStore } from './store'

function route(items: UploadItem[]): void {
  const state = useGeneratorStore.getState()

  if (state.tab === 'references') {
    state.addReferences(items)

    return
  }

  const preset = getPreset(state.presetId)
  let slot: 'start' | 'end' = 'start'

  const hasStart = !isNil(state.frames.start) && state.frames.start !== ''
  const hasEnd = !isNil(state.frames.end) && state.frames.end !== ''

  if (hasStart && preset.frames.end && !hasEnd) slot = 'end'

  const image = items.find((item) => item.kind === 'image')

  if (!image) {
    toast.error('Frames need an image')

    return
  }

  state.setFrame(slot, image)
}

/** Kinds the active tab can still take. */
function allowedKinds(): MediaKind[] {
  const state = useGeneratorStore.getState()

  if (state.tab !== 'references') return ['image']

  const preset = getPreset(state.presetId)
  const { counts } = referenceSlots(state.references, (id) => state.uploadsById[id]?.kind)

  return MEDIA_KINDS.filter((kind) => counts[kind] < preset.references[kind])
}

/** Preset formats for the active model. */
function allowedExtensions(): PickerExtensions | undefined {
  return extensionsFromLimits(getPreset(useGeneratorStore.getState().presetId).referenceLimits)
}

/** Paste uploads into the active tab. */
export function usePanelPaste() {
  const handlePasteFiles = (files: File[]): void => {
    void uploadFiles(files)
      .then(route)
      .catch((error) => toast.error(errorMessage(error)))
  }
  const { onPaste: handlePaste } = usePasteMedia({
    enabled: true,
    scope: 'element',
    kinds: allowedKinds,
    extensions: allowedExtensions,
    onFiles: handlePasteFiles,
    onUploaded: route,
  })

  return { handlePaste }
}

/**
 * Refreshes cached uploads for attached frames and references on focus.
 */
export function useUploadsRefresh() {
  const frames = useGeneratorStore((state) => state.frames)
  const references = useGeneratorStore((state) => state.references)
  const idsKey = useMemo(
    () =>
      [...new Set([frames.start, frames.end, ...references])]
        .filter((id): id is string => Boolean(id))
        .sort()
        .join(','),
    [frames.start, frames.end, references],
  )

  useEffect(() => {
    const refresh = () => {
      const ids = idsKey.split(',').filter(Boolean)

      if (ids.length === 0) return

      void fetchUploads({ ids })
        .then((items) => useGeneratorStore.getState().upsertUploads(items))
        .catch((error) => toast.error(errorMessage(error)))
    }

    refresh()
    window.addEventListener('focus', refresh)

    return () => window.removeEventListener('focus', refresh)
  }, [idsKey])
}
