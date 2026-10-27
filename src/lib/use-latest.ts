'use client'

import { useEffect, useRef } from 'react'

export interface LatestRef<T> {
  current: T
}

/** Ref kept in sync with the latest value, for callbacks opened earlier. */
export function useLatest<T>(value: T): LatestRef<T> {
  const ref = useRef(value)

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref
}
