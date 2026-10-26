'use client'

import { useEffect, useMemo } from 'react'
import { toast } from 'sonner'

import { isNonEmptyString } from '@/core/guards'
import { type KindExtensions } from '@/core/media-kinds'
import { MEDIA_KINDS, type MediaKind } from '@/core/media-types'
import { getPreset } from '@/core/presets'
import { referenceSlots } from '@/core/prompt-tokens'
import type { UploadItem } from '@/core/schemas/upload-item'
import { extensionsFromLimits } from '@/features/media-picker/picker/store'
import { usePasteMedia } from '@/features/media-picker/uploads/use-paste-media'
import { fetchUploads, uploadFiles } from '@/lib/api/uploads'
import { toastError } from '@/lib/notify'

import { useGeneratorStore } from '../store/store'

function route(items: UploadItem[]): void {
  const state = useGeneratorStore.getState()

  if (state.tab === 'references') {
    state.addReferences(items)

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

/** Paste uploads into the active tab. */
export function usePanelPaste() {
  const handlePasteFiles = (files: File[]): void => {
    void uploadFiles(files)
      .then(route)
      .catch((error) => {
        toastError(error)
      })
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
  const frames = useGeneratorStore((state) => {
    return state.frames
  })

  const references = useGeneratorStore((state) => {
    return state.references
  })

  const idsKey = useMemo(() => {
    return [...new Set([frames.start, frames.end, ...references])]
      .filter((id): id is string => {
        return Boolean(id)
      })
      .sort()
      .join(',')
  }, [frames.start, frames.end, references])

  useEffect(() => {
    const refresh = () => {
      const ids = idsKey.split(',').filter(Boolean)

      if (ids.length === 0) {
        return
      }

      void fetchUploads({ ids })
        .then((items) => {
          useGeneratorStore.getState().upsertUploads(items)
        })
        .catch((error) => {
          toastError(error)
        })
    }

    refresh()
    window.addEventListener('focus', refresh)

    return () => {
      window.removeEventListener('focus', refresh)
    }
  }, [idsKey])
}
