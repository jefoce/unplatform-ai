import 'server-only'

import type { EndpointHealthStatus } from '@/core/endpoints'

export interface CustomHealthOutcome {
  state: EndpointHealthStatus
  message: string | null
  maxRunning: number | null
}

export type CustomHealthListener = (endpointId: string, outcome: CustomHealthOutcome) => void

let listener: CustomHealthListener | null = null

export function registerCustomHealthListener(next: CustomHealthListener): void {
  listener = next
}

export function emitCustomHealth(endpointId: string, outcome: CustomHealthOutcome): void {
  listener?.(endpointId, outcome)
}
