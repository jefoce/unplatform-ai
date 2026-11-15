import 'server-only'

import { CATALOG_UNREACHABLE_REASON } from '@/core/catalog'

import { setMockReachable } from '../providers/mock/custom-mock-state'
import { forgetEndpointHealth, recordHealthFailure, recordHealthOk } from './endpoint-health'
import { clearModelCatalog } from './model-catalog'

interface SetMockEndpointReachableParams {
  id: string
  isReachable: boolean
  isChecking: boolean
}

/** Applies a demo reachability switch and keeps health and the catalog in sync. */
export function setMockEndpointReachable(params: SetMockEndpointReachableParams): void {
  const { id, isReachable, isChecking } = params

  setMockReachable(id, isReachable)

  if (isChecking) {
    forgetEndpointHealth(id)
  } else if (isReachable) {
    recordHealthOk(id)
  } else {
    recordHealthFailure({
      endpointId: id,
      status: 'unreachable',
      message: CATALOG_UNREACHABLE_REASON,
    })
  }

  clearModelCatalog()
}
