'use client'

import { useEffect, useRef } from 'react'
import { isEmpty, isNil, sumBy } from 'lodash-es'

import type { UploadsById } from '@/core/api/uploads'
import type { KindExtensions } from '@/core/media/media-kinds'
import { MEDIA_KINDS, type MediaKind } from '@/core/media/media-types'
import { getPreset } from '@/core/presets'
import type { UploadItem } from '@/core/schemas/upload-item'
import { pickerAnchor, registerPickerAnchor } from '@/features/media-picker/picker/anchors'
import {
  extensionsFromLimits,
  openMediaPicker,
  outputKey,
  type PickerCandidate,
  type PickerOutputCandidate,
  useMediaPickerStore,
} from '@/features/media-picker/picker/store'

import { applyPickerOutput } from '../media-actions'
import { referenceBlockReason, referenceRoom } from '../reference-rules'
import { useGeneratorStore } from '../store/store'
import { ReferencesEmpty } from './ReferencesEmpty'
import { ReferencesGrid } from './ReferencesGrid'

function useReferenceIds(): string[] {
  return useGeneratorStore((state) => {
    return state.references
  })
}

function getReferenceIds(): string[] {
  return useGeneratorStore.getState().references
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

  return referenceBlockReason({
    kind: item.kind,
    max: preset.references[item.kind],
    room: room[item.kind],
  })
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

/** Reason a saved generation cannot be attached, null when it has room. */
function canAddOutput(candidate: PickerOutputCandidate): string | null {
  const state = useGeneratorStore.getState()
  const preset = getPreset(state.presetId)

  const room = referenceRoom({
    preset,
    references: state.references,
    uploadsById: state.uploadsById,
  })

  return referenceBlockReason({
    kind: candidate.recordKind,
    max: preset.references[candidate.recordKind],
    room: room[candidate.recordKind],
  })
}

async function addReferenceOutput(candidate: PickerOutputCandidate, key: string): Promise<void> {
  const before = new Set(useGeneratorStore.getState().references)
  const isApplied = await applyPickerOutput({ candidate, target: 'reference' })

  if (!isApplied) {
    return
  }

  const added = useGeneratorStore.getState().references.find((id) => {
    return !before.has(id)
  })

  if (!isNil(added)) {
    useMediaPickerStore.getState().setOutputUpload(key, added)
  }
}

function applyReferenceOutput(candidate: PickerOutputCandidate): void {
  const key = outputKey(candidate)
  const picker = useMediaPickerStore.getState()
  const uploadId = picker.outputUploads[key]

  if (!isNil(uploadId)) {
    useGeneratorStore.getState().removeReference(uploadId)
    picker.setOutputUpload(key, null)

    return
  }

  void addReferenceOutput(candidate, key)
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
    generations: 'both',
    mode: {
      kind: 'toggle',
      useSelectedIds: useReferenceIds,
      getSelectedIds: getReferenceIds,
      useUploadsById,
      canAdd: referenceCanAdd,
      onToggle: toggleReference,
      onAdd: addReference,
    },
    output: {
      canAdd: canAddOutput,
      onToggle: applyReferenceOutput,
      onAdd: applyReferenceOutput,
    },
  })
}

interface ReferencesBoxProps {
  isUploadsLoading?: boolean
}

/** References tab: limits, thumbs, reorder, drag-drop and mention insert. */
export function ReferencesBox(props: ReferencesBoxProps) {
  const { isUploadsLoading } = props

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
        <ReferencesGrid
          preset={preset}
          extensions={extensions}
          max={max}
          isUploadsLoading={isUploadsLoading}
          onPick={handlePick}
        />
      )}
      {isEmpty(references) && <ReferencesEmpty preset={preset} onPick={handlePick} />}
    </div>
  )
}
