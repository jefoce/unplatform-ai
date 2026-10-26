'use client'

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'

export interface AsyncAction<TArgs extends unknown[]> {
  isRunning: boolean
  run: (...args: TArgs) => Promise<void>
}

/** Runs one async action at a time and exposes its busy flag. Errors propagate to the action itself. */
export function useAsyncAction<TArgs extends unknown[]>(
  action: (...args: TArgs) => Promise<void>,
): AsyncAction<TArgs> {
  const [isRunning, setIsRunning] = useState(false)
  const isRunningRef = useRef(false)
  const actionRef = useRef(action)

  // Latest-callback pattern. Layout effect so a run fired in the same commit sees the current action. Client-only file, no SSR warning.
  useLayoutEffect(() => {
    actionRef.current = action
  })

  const run = useCallback(async (...args: TArgs): Promise<void> => {
    if (isRunningRef.current) {
      return
    }

    isRunningRef.current = true
    setIsRunning(true)

    try {
      await actionRef.current(...args)
    } finally {
      isRunningRef.current = false
      setIsRunning(false)
    }
  }, [])

  return useMemo(() => {
    return { isRunning, run }
  }, [isRunning, run])
}
