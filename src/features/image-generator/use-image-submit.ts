'use client'

import { toast } from 'sonner'

import { issueText } from '@/core/validation/common'
import { validateImageInput } from '@/core/validation/image'
import { requestNotifications } from '@/features/shared/request-notifications'
import { refreshCredits } from '@/lib/api/credits'
import { createImage } from '@/lib/api/images'
import { refreshImages } from '@/lib/image-feed-refresh'
import { toastError } from '@/lib/notify'
import { useAsyncAction } from '@/lib/use-async-action'

import { imageInputFromState } from './image-submit-input'
import { currentImagePreset } from './preset'
import { useImageGeneratorStore } from './store'

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
    const preset = currentImagePreset(state.presetId)
    const input = imageInputFromState(state)
    const problems = validateImageInput(preset, input)

    if (problems.length > 0) {
      const [message = 'Invalid input'] = problems.map(issueText)

      toast.error(message)

      return
    }

    requestNotifications()

    try {
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
