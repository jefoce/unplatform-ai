'use client'

import { keyBy } from 'lodash-es'

import type { UploadsById } from '@/core/api/uploads'
import type { VideoPreset } from '@/core/presets/video/types'
import { referenceSlots } from '@/core/prompt-tokens'

import { referenceUploads } from './reference-notes'
import { useImagePlan } from './use-image-plan'

interface ReferencePlanParams {
  preset: VideoPreset
  order: string[]
  references: string[]
  uploadsById: UploadsById
}

/** Slot plan, counters and preview uploads for the reference grid. */
export function useReferencePlan(params: ReferencePlanParams) {
  const { preset, order, references, uploadsById } = params

  const { counts, slots } = referenceSlots(order, (id) => {
    return uploadsById[id]?.kind
  })

  const plan = useImagePlan(
    preset.id,
    references.filter((id) => {
      return uploadsById[id]?.kind === 'image'
    }),
  )

  const planned = keyBy(plan?.images ?? [], 'id')
  const previewUploads = referenceUploads(references, uploadsById)

  return { counts, slots, plan, planned, previewUploads }
}
