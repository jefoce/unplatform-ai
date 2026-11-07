export const ENDPOINT_HEALTH_STATES = [
  'ok',
  'unreachable',
  'unauthorized',
  'forbidden',
  'protocol',
] as const

export type EndpointHealthStatus = (typeof ENDPOINT_HEALTH_STATES)[number]

export interface EndpointHealthState {
  state: EndpointHealthStatus
  checkedAt: string
  message: string | null
}
