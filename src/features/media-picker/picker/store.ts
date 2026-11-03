'use client'

import { isEmpty, isNil, omit } from 'lodash-es'
import { create } from 'zustand'

import type { UploadsById } from '@/core/api/uploads'
import type { RecordKind } from '@/core/feed/grid-item'
import { type KindExtensions } from '@/core/media/media-kinds'
import { MEDIA_KINDS, type MediaKind } from '@/core/media/media-types'
import type { PresetReferenceLimits } from '@/core/presets/common/reference-limits'
import type { UploadItem } from '@/core/schemas/upload-item'

export type PickerCandidate = Pick<UploadItem, 'id' | 'kind'>

export type PickerGenerationMode = 'none' | 'image' | 'video' | 'both'

/** One saved generation output a picker tab can offer. */
export interface PickerOutputCandidate {
  recordId: string
  outputId: string | null
  recordKind: RecordKind
  favorite: boolean
}

/** Callbacks a caller supplies to make generation tabs selectable. */
export interface PickerOutputMode {
  canAdd?: (item: PickerOutputCandidate) => string | null
  onToggle?: (item: PickerOutputCandidate) => void
  onAdd?: (item: PickerOutputCandidate) => void
  onPick?: (item: PickerOutputCandidate) => void
}

export interface PickerToggleMode {
  kind: 'toggle'
  useSelectedIds: () => string[]
  getSelectedIds: () => string[]
  useUploadsById: () => UploadsById
  canAdd: (item: PickerCandidate) => string | null
  onToggle: (item: UploadItem) => void
  onAdd: (item: UploadItem) => void
}

export interface PickerPickMode {
  kind: 'pick'
  onPick: (item: UploadItem) => void
}

export type PickerMode = PickerToggleMode | PickerPickMode

export interface PickerRequest {
  id: number

  /** Control that opened the picker. A different opener replaces the request. */
  openerKey: string
  kinds: MediaKind[]
  extensions?: KindExtensions
  mode: PickerMode

  /** Which generation tabs to show. Derived from kinds when omitted. */
  generations?: PickerGenerationMode
  output?: PickerOutputMode

  /** Region that keeps the picker open, not the clicked control. */
  anchor: HTMLElement | null

  /** Dock side on wide screens. Defaults to the right of the anchor. */
  placement?: 'right' | 'top'
}

/** Generation tabs to show, defaulting from the requested media kinds. */
export function pickerGenerations(
  request: Pick<PickerRequest, 'generations' | 'kinds'>,
): PickerGenerationMode {
  if (!isNil(request.generations)) {
    return request.generations
  }

  const isVideoWanted = request.kinds.includes('video') || request.kinds.includes('audio')

  if (isVideoWanted) {
    return 'both'
  }

  return 'image'
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

interface PickerInput extends Omit<PickerRequest, 'id' | 'anchor'> {
  anchor?: HTMLElement | null
}

interface MediaPickerState {
  request: PickerRequest | null
  outputUploads: Record<string, string>
  open: (request: PickerInput) => void
  close: () => void
  setOutputUpload: (key: string, uploadId: string | null) => void
}

/** Stable key for one generation output across picker tabs. */
export function outputKey(item: PickerOutputCandidate): string {
  return `${item.recordKind}:${item.recordId}:${item.outputId ?? ''}`
}

let nextId = 0

export const useMediaPickerStore = create<MediaPickerState>((set, get) => {
  return {
    request: null,
    outputUploads: {},
    open: (request) => {
      const current = get().request

      // Same opener keeps its request; a different one replaces it.
      if (!isNil(current) && current.openerKey === request.openerKey) {
        return
      }

      set({
        request: { ...request, anchor: request.anchor ?? null, id: (nextId += 1) },
        outputUploads: {},
      })
    },
    close: () => {
      set({ request: null, outputUploads: {} })
    },
    setOutputUpload: (key, uploadId) => {
      set((state) => {
        if (isNil(uploadId)) {
          return { outputUploads: omit(state.outputUploads, key) }
        }

        return { outputUploads: { ...state.outputUploads, [key]: uploadId } }
      })
    },
  }
})

/** Opens the shared picker, keeping the request when the same opener is already open. */
export function openMediaPicker(request: PickerInput): void {
  useMediaPickerStore.getState().open(request)
}

/** Closes the picker without picking. */
export function closeMediaPicker(): void {
  useMediaPickerStore.getState().close()
}
