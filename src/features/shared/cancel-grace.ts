'use client'

import { toast } from 'sonner'

import { ApiError } from '@/lib/fetcher'
import { toastError } from '@/lib/notify'

interface CancelGraceParams {
  request: () => Promise<void>
  refresh: () => Promise<unknown>
  successText: string
}

/** Cancels a grace-window record, then refreshes its feed. */
export async function cancelGrace(params: CancelGraceParams): Promise<void> {
  const { request, refresh, successText } = params

  try {
    await request()
    toast.success(successText)
    await refresh()
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      toast.error('Already sent, cannot cancel')
      await refresh()

      return
    }

    toastError(error)
  }
}
