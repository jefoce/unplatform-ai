'use client'

import { useEffect, useRef } from 'react'
import { isEmpty, isNil, sumBy } from 'lodash-es'

import type { KindExtensions } from '@/core/media-kinds'
import { MEDIA_KINDS, type MediaKind } from '@/core/media-types'
import { getPreset } from '@/core/presets'
import type { UploadItem, UploadsById } from '@/core/schemas/upload-item'
import { pickerAnchor, registerPickerAnchor } from '@/features/media-picker/picker/anchors'
import {
  extensionsFromLimits,
  openMediaPicker,
  type PickerCandidate,
} from '@/features/media-picker/picker/store'

import { addBlockReason, referenceRoom } from '../reference-rules'
import { useGeneratorStore } from '../store/store'
import { ReferencesEmpty } from './ReferencesEmpty'
import { ReferencesGrid } from './ReferencesGrid'

function useReferenceIds(): string[] {
  return useGeneratorStore((state) => {
    return state.references
  })
}

function useUploadsById(): UploadsById {
  return useGeneratorStore((state) => {
    return state.uploadsById
  })
}

/** Reason an upload cannot be attached, null when it can. */
function referenceCanAdd(item: PickerCandidate): string | null {
  const state = useGeneratorStore.getState()
  const preset = getPreset(state.presetId)

  const room = referenceRoom({
    preset,
    references: state.references,
    uploadsById: state.uploadsById,
  })

  return addBlockReason({ kind: item.kind, room, preset })
}

/** Attaches an upload, or removes it when already attached. */
function toggleReference(item: UploadItem): void {
  const state = useGeneratorStore.getState()

  if (state.references.includes(item.id)) {
    state.removeReference(item.id)

    return
  }

  state.addReferences([item])
}

/** Attaches an upload once, leaving an attached one in place. */
function addReference(item: UploadItem): void {
  useGeneratorStore.getState().addReferences([item])
}

interface OpenReferencesPickerParams {
  kinds: MediaKind[]
  extensions?: KindExtensions
}

/** Opens reference picking in toggle mode. */
function openReferencesPicker(params: OpenReferencesPickerParams): void {
  const { kinds, extensions } = params

  if (isEmpty(kinds)) {
    return
  }

  openMediaPicker({
    openerKey: 'references:add',
    kinds,
    extensions,
    anchor: pickerAnchor('references'),
    mode: {
      kind: 'toggle',
      useSelectedIds: useReferenceIds,
      useUploadsById,
      canAdd: referenceCanAdd,
      onToggle: toggleReference,
      onAdd: addReference,
    },
  })
}

/** References tab: limits, thumbs, reorder, drag-drop and mention insert. */
export function ReferencesBox() {
  const preset = getPreset(
    useGeneratorStore((state) => {
      return state.presetId
    }),
  )

  const extensions = extensionsFromLimits(preset.referenceLimits)

  const references = useGeneratorStore((state) => {
    return state.references
  })

  const uploadsById = useGeneratorStore((state) => {
    return state.uploadsById
  })

  const room = referenceRoom({ preset, references, uploadsById })

  const kinds = MEDIA_KINDS.filter((kind) => {
    return preset.references[kind] > 0
  })

  const max = sumBy(MEDIA_KINDS, (kind) => {
    return room[kind]
  })

  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = boxRef.current

    if (isNil(element)) {
      return
    }

    return registerPickerAnchor('references', element)
  }, [])

  const handlePick = (): void => {
    openReferencesPicker({ kinds, extensions })
  }

  return (
    <div ref={boxRef} data-references-box>
      {references.length > 0 && (
        <ReferencesGrid preset={preset} extensions={extensions} max={max} onPick={handlePick} />
      )}
      {isEmpty(references) && <ReferencesEmpty preset={preset} onPick={handlePick} />}
    </div>
  )
}
