'use client'

import { useEffect } from 'react'

import { UPDATE_CHECK_DELAY_MS, UPDATE_CHECK_INTERVAL_MS } from '@/core/constants'
import { platform } from '@/lib/platform'

import { checkForUpdate } from './check-update'
import { useUpdateStore } from './update-store'

type TimerId = ReturnType<typeof setTimeout>

/** Mount once in the app shell: loads app info, then checks on the auto-check schedule. */
export function useUpdateCheck(): void {
  const isAutoCheckOn = useUpdateStore((state) => {
    return state.appInfo?.autoCheck === true
  })

  const installKind = useUpdateStore((state) => {
    return state.appInfo?.installKind
  })

  useEffect(() => {
    void platform
      .appInfo()
      .then((info) => {
        useUpdateStore.getState().setAppInfo(info)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isAutoCheckOn || installKind === 'browser') {
      return
    }

    const firstCheck: TimerId = setTimeout(() => {
      void checkForUpdate(false)
    }, UPDATE_CHECK_DELAY_MS)

    const repeatCheck: TimerId = setInterval(() => {
      void checkForUpdate(false)
    }, UPDATE_CHECK_INTERVAL_MS)

    return () => {
      clearTimeout(firstCheck)
      clearInterval(repeatCheck)
    }
  }, [isAutoCheckOn, installKind])
}
