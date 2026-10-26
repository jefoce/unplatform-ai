'use client'

import { messageOf } from '@/core/errors'
import { platform } from '@/lib/platform'

import { useUpdateStore } from './update-store'

/** Checks once, then stores the result. A background failure keeps the current state. */
export async function checkForUpdate(isManual: boolean): Promise<void> {
  const state = useUpdateStore.getState()

  if (state.status === 'downloading' || state.status === 'installing') {
    return
  }

  if (isManual) {
    state.startCheck()
  }

  try {
    const update = await platform.checkUpdate()

    useUpdateStore.getState().applyCheckResult(update)
  } catch (error) {
    if (!isManual) {
      return
    }

    useUpdateStore.getState().markError(messageOf(error, 'Could not check for updates'))
  }
}
