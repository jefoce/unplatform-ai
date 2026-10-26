'use client'

import { useCallback, useMemo, useState } from 'react'

export interface BooleanState {
  value: boolean
  set: (next: boolean) => void
  on: () => void
  off: () => void
  toggle: () => void
}

/** Boolean state with stable on, off, toggle and set callbacks. */
export function useBoolean(isInitiallyOn = false): BooleanState {
  const [isOn, setIsOn] = useState(isInitiallyOn)

  const on = useCallback(() => {
    setIsOn(true)
  }, [])

  const off = useCallback(() => {
    setIsOn(false)
  }, [])

  const toggle = useCallback(() => {
    setIsOn((isCurrent) => {
      return !isCurrent
    })
  }, [])

  return useMemo(() => {
    return { value: isOn, set: setIsOn, on, off, toggle }
  }, [isOn, off, on, toggle])
}
