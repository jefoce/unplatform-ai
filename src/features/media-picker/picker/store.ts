'use client'

import { isEmpty, isNil } from 'lodash-es'
import { create } from 'zustand'

import { type KindExtensions } from '@/core/media-kinds'
import { MEDIA_KINDS, type MediaKind } from '@/core/media-types'
import type { PresetReferenceLimits } from '@/core/presets/types'
import type { UploadItem } from '@/core/schemas/upload-item'

type PickerTarget = 'frame-start' | 'frame-end' | 'references'

export interface PickerRequest {
  id: number
  target: PickerTarget
  kinds: MediaKind[]
  max: number
  extensions?: KindExtensions
  onPick: (items: UploadItem[]) => void
}

/** Picker extensions from preset reference formats, ignoring kinds without a list. */
export function extensionsFromLimits(
  limits: PresetReferenceLimits | undefined,
): KindExtensions | undefined {
  const entries = MEDIA_KINDS.flatMap((kind) => {
    const formats = limits?.[kind]?.formats

    if (isNil(formats) || formats.length === 0) {
      return []
    }

    return [[kind, formats] as const]
  })

  if (isEmpty(entries)) {
    return undefined
  }

  return Object.fromEntries(entries)
}

type PickerInput = Omit<PickerRequest, 'id'>

interface MediaPickerState {
  request: PickerRequest | null
  open: (request: PickerInput) => void
  close: () => void
}

let nextId = 0

export const useMediaPickerStore = create<MediaPickerState>((set) => {
  return {
    request: null,
    open: (request) => {
      set({ request: { ...request, id: (nextId += 1) } })
    },
    close: () => {
      set({ request: null })
    },
  }
})

/** Opens the shared picker, replacing any current request. */
export function openMediaPicker(request: PickerInput): void {
  useMediaPickerStore.getState().open(request)
}

/** Closes the picker without picking. */
export function closeMediaPicker(): void {
  useMediaPickerStore.getState().close()
}
