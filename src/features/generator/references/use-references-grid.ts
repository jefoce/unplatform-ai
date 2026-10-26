'use client'

import type { ModelPreset } from '@/core/presets/types'

import { useGeneratorStore } from '../store/store'
import { useReferencePlan } from './use-reference-plan'
import { useReferencesDnd } from './use-references-dnd'

/** Store selectors, drag state and plan values for the reference grid. */
export function useReferencesGrid(preset: ModelPreset) {
  const references = useGeneratorStore((state) => {
    return state.references
  })

  const uploadsById = useGeneratorStore((state) => {
    return state.uploadsById
  })

  const insertMention = useGeneratorStore((state) => {
    return state.insertMention
  })

  const replaceReference = useGeneratorStore((state) => {
    return state.replaceReference
  })

  const removeReference = useGeneratorStore((state) => {
    return state.removeReference
  })

  const {
    activeId,
    order,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useReferencesDnd(references)

  const planValues = useReferencePlan({ preset, order, references, uploadsById })

  return {
    references,
    uploadsById,
    insertMention,
    replaceReference,
    removeReference,
    activeId,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    ...planValues,
  }
}
