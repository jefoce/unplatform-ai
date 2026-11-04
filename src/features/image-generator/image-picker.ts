'use client'

import { isNil } from 'lodash-es'

import type { UploadsById } from '@/core/api/uploads'
import type { UploadItem } from '@/core/schemas/upload-item'
import { REFERENCE_ONLY_IMAGES, referenceBlockReason } from '@/features/generator/reference-rules'
import { pickerAnchor } from '@/features/media-picker/picker/anchors'
import {
  openMediaPicker,
  outputKey,
  type PickerCandidate,
  type PickerOutputCandidate,
  useMediaPickerStore,
} from '@/features/media-picker/picker/store'
import { createImageOutputUpload } from '@/lib/api/images'
import { toastError } from '@/lib/notify'

import { currentImagePreset, imageReferenceMax } from './preset'
import { useImageGeneratorStore } from './store'

function useReferenceIds(): string[] {
  return useImageGeneratorStore((state) => {
    return state.references
  })
}

function getReferenceIds(): string[] {
  return useImageGeneratorStore.getState().references
}

function useUploadsById(): UploadsById {
  return useImageGeneratorStore((state) => {
    return state.uploadsById
  })
}

export function imageCanAdd(item: PickerCandidate): string | null {
  const state = useImageGeneratorStore.getState()
  const preset = currentImagePreset(state.presetId)
  const max = imageReferenceMax(preset)
  const kindMax = item.kind === 'image' ? max : 0

  return referenceBlockReason({
    kind: item.kind,
    max: kindMax,
    room: max - state.references.length,
    isAttached: state.references.includes(item.id),
    isImageOnly: true,
  })
}

function toggleReference(item: UploadItem): void {
  const state = useImageGeneratorStore.getState()

  if (state.references.includes(item.id)) {
    state.removeReference(item.id)

    return
  }

  state.addReferences([item])
}

function addReference(item: UploadItem): void {
  useImageGeneratorStore.getState().addReferences([item])
}

function canAddOutput(candidate: PickerOutputCandidate): string | null {
  const state = useImageGeneratorStore.getState()
  const preset = currentImagePreset(state.presetId)

  if (candidate.recordKind !== 'image' || isNil(candidate.outputId)) {
    return REFERENCE_ONLY_IMAGES
  }

  const max = imageReferenceMax(preset)

  return referenceBlockReason({
    kind: candidate.recordKind,
    max,
    room: max - state.references.length,
    isImageOnly: true,
  })
}

const inFlightOutputs = new Set<string>()

async function addOutput(candidate: PickerOutputCandidate): Promise<void> {
  if (isNil(candidate.outputId)) {
    return
  }

  const key = outputKey(candidate)

  if (inFlightOutputs.has(key)) {
    return
  }

  inFlightOutputs.add(key)

  try {
    const upload = await createImageOutputUpload({
      recordId: candidate.recordId,
      outputId: candidate.outputId,
    })

    const state = useImageGeneratorStore.getState()
    const preset = currentImagePreset(state.presetId)
    const max = imageReferenceMax(preset)

    const blocked = referenceBlockReason({
      kind: 'image',
      max,
      room: max - state.references.length,
      isImageOnly: true,
    })

    if (!isNil(blocked)) {
      return
    }

    state.addReferences([upload])
    useMediaPickerStore.getState().setOutputUpload(key, upload.id)
  } catch (error) {
    toastError(error)
  } finally {
    inFlightOutputs.delete(key)
  }
}

function toggleOutput(candidate: PickerOutputCandidate): void {
  const key = outputKey(candidate)
  const picker = useMediaPickerStore.getState()
  const uploadId = picker.outputUploads[key]

  if (!isNil(uploadId)) {
    useImageGeneratorStore.getState().removeReference(uploadId)
    picker.setOutputUpload(key, null)

    return
  }

  void addOutput(candidate)
}

function pickOutput(candidate: PickerOutputCandidate): void {
  void addOutput(candidate)
}

/** Opens the picker to swap one image reference for another. */
export function openImageReplacePicker(id: string): void {
  openMediaPicker({
    openerKey: `image:references:replace:${id}`,
    kinds: ['image'],
    generations: 'image',
    anchor: pickerAnchor('image-prompt'),
    placement: 'top',
    width: 'anchor',
    mode: {
      kind: 'pick',
      onPick: (item) => {
        useImageGeneratorStore.getState().replaceReference(id, item)
      },
    },
  })
}

/** Opens the media picker in image reference toggle mode. */
export function openReferencePicker(): void {
  openMediaPicker({
    openerKey: 'image:references',
    kinds: ['image'],
    generations: 'image',
    anchor: pickerAnchor('image-prompt'),
    placement: 'top',
    width: 'anchor',
    mode: {
      kind: 'toggle',
      useSelectedIds: useReferenceIds,
      getSelectedIds: getReferenceIds,
      useUploadsById,
      canAdd: imageCanAdd,
      onToggle: toggleReference,
      onAdd: addReference,
    },
    output: {
      canAdd: canAddOutput,
      onToggle: toggleOutput,
      onAdd: toggleOutput,
      onPick: pickOutput,
    },
  })
}
