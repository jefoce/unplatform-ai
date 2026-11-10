import { isNil } from 'lodash-es'

export const ENDPOINT_HEALTH_STATES = [
  'ok',
  'unreachable',
  'unauthorized',
  'forbidden',
  'protocol',
] as const

export type EndpointHealthStatus = (typeof ENDPOINT_HEALTH_STATES)[number]

const OFFLINE_ENDPOINT_HEALTH_STATES: readonly EndpointHealthStatus[] = [
  'unreachable',
  'forbidden',
  'unauthorized',
]

export interface EndpointHealthState {
  state: EndpointHealthStatus
  checkedAt: string
  message: string | null
}

/** States that close the endpoint for the Generate gate and the offline pill. */
export function isOfflineHealthStatus(
  status: EndpointHealthStatus | 'unknown' | null | undefined,
): boolean {
  if (isNil(status) || status === 'unknown') {
    return false
  }

  return OFFLINE_ENDPOINT_HEALTH_STATES.includes(status)
}
