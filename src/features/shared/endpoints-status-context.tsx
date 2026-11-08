'use client'

import { createContext, type ReactNode, useContext } from 'react'

import { type EndpointsState, useEndpointsStatus } from '@/lib/api/endpoints-status'

const EMPTY_SNAPSHOT: EndpointsState = { endpoints: [], isLoading: true, error: null }

const EndpointsSnapshotContext = createContext<EndpointsState>(EMPTY_SNAPSHOT)

interface EndpointsStatusProviderProps {
  children: ReactNode
}

/** One endpoint subscription shared by the workspace rows, tiles and details. */
export function EndpointsStatusProvider(props: EndpointsStatusProviderProps) {
  const { children } = props
  const snapshot = useEndpointsStatus()

  return (
    <EndpointsSnapshotContext.Provider value={snapshot}>
      {children}
    </EndpointsSnapshotContext.Provider>
  )
}

/** Endpoint list and load state from the nearest provider. */
export function useEndpointsSnapshot(): EndpointsState {
  return useContext(EndpointsSnapshotContext)
}
