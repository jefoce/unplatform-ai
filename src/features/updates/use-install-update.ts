'use client'

import { isNil } from 'lodash-es'
import { toast } from 'sonner'

import { messageOf } from '@/core/errors'
import { platform } from '@/lib/platform'
import { type AsyncAction, useAsyncAction } from '@/lib/use-async-action'

import { progressText } from './progress-text'
import { useUpdateStore } from './update-store'

const PROGRESS_TOAST_ID = 'update-progress'

/** Shared install action for the toast and Settings. A cancel restores the available update. */
export function useInstallUpdate(): AsyncAction<[]> {
  return useAsyncAction(async () => {
    const state = useUpdateStore.getState()
    const update = state.update

    if (isNil(update)) {
      return
    }

    state.startInstall()
    toast.loading('Downloading 0%', { id: PROGRESS_TOAST_ID })

    try {
      const result = await platform.installUpdate((progress) => {
        useUpdateStore.getState().setProgress(progress)
        toast.loading(progressText(progress), { id: PROGRESS_TOAST_ID })
      })

      if (result.cancelled) {
        useUpdateStore.getState().markCancelled(update)
        toast.dismiss(PROGRESS_TOAST_ID)

        return
      }

      toast.loading('Installing...', { id: PROGRESS_TOAST_ID })
    } catch (error) {
      const message = messageOf(error, 'Update failed')

      useUpdateStore.getState().markError(message)
      toast.error(message, { id: PROGRESS_TOAST_ID })
    }
  })
}
