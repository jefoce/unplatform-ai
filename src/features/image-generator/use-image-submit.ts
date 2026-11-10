'use client'

import { isNil } from 'lodash-es'
import { toast } from 'sonner'

import { CATALOG_MISSING_REASON } from '@/core/catalog'
import { findImagePreset } from '@/core/presets/image'
import type { ImageGenerationInput } from '@/core/schemas/image-record'
import { issueText } from '@/core/validation/common'
import { validateImageInput } from '@/core/validation/image'
import { requestNotifications } from '@/features/shared/request-notifications'
import { refreshCredits } from '@/lib/api/credits'
import { freshPresetReason } from '@/lib/api/endpoints-status'
import { createImage } from '@/lib/api/images'
import { refreshImages } from '@/lib/image-feed-refresh'
import { toastError } from '@/lib/notify'
import { useAsyncAction } from '@/lib/use-async-action'

import { imageDraftForPreset } from './image-draft'
import { imageInputFromState } from './image-submit-input'
import { useImageGeneratorStore } from './store'

/** Notes for the image draft fields that a new preset changed. */
function draftNotes(before: ImageGenerationInput, after: ImageGenerationInput): string[] {
  const notes: string[] = []

  if (after.resolution !== before.resolution) {
    const value = after.resolution ?? 'none'

    notes.push(`Resolution set to ${value}`)
  }

  if (after.aspectRatio !== before.aspectRatio) {
    notes.push(`Aspect set to ${after.aspectRatio}`)
  }

  const removed = before.references.length - after.references.length

  if (removed > 0) {
    const suffix = removed === 1 ? '' : 's'

    notes.push(`Removed ${removed} image reference${suffix}`)
  }

  return notes
}

interface ImageSubmitOptions {
  canSubmit: boolean
}

/** Validates and submits the image draft, keeping it for the next run. */
export function useImageSubmit(options: ImageSubmitOptions) {
  const { canSubmit } = options

  const submission = useAsyncAction(async () => {
    if (!canSubmit) {
      return
    }

    const state = useImageGeneratorStore.getState()

    try {
      const fresh = await freshPresetReason(state.presetId)

      if (!isNil(fresh)) {
        toast.error(fresh)

        return
      }

      const preset = findImagePreset(state.presetId)

      if (isNil(preset)) {
        toast.error(CATALOG_MISSING_REASON)

        return
      }

      const before = imageInputFromState(state)
      const input = imageDraftForPreset(before, preset)
      const notes = draftNotes(before, input)

      if (notes.length > 0) {
        toast(notes.join(' \u00b7 '))
      }

      useImageGeneratorStore.setState(input)

      const problems = validateImageInput(preset, input)

      if (problems.length > 0) {
        const [message = 'Invalid input'] = problems.map(issueText)

        toast.error(message)

        return
      }

      requestNotifications()

      await createImage(input)
      const message = input.count > 1 ? `Generating ${input.count} images` : 'Generating image'

      toast.success(message)
      await Promise.all([refreshImages(), refreshCredits(true)])
    } catch (error) {
      toastError(error)
    }
  })

  return { submit: submission.run, isSubmitting: submission.isRunning }
}
