import 'server-only'

import { setMockReachable } from '../providers/mock/custom-mock-state'
import { forgetEndpointHealth, recordHealthOk } from './endpoint-health'
import { clearModelCatalog } from './model-catalog'

interface SetMockEndpointReachableParams {
  id: string
  isReachable: boolean
}

/** Applies a demo reachability switch and keeps health and the catalog in sync. */
export function setMockEndpointReachable(params: SetMockEndpointReachableParams): void {
  const { id, isReachable } = params

  setMockReachable(id, isReachable)

  if (isReachable) {
    recordHealthOk(id)
  } else {
    forgetEndpointHealth(id)
  }

  clearModelCatalog()
}
