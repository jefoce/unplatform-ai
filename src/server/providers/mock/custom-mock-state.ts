import 'server-only'

import { globalState } from '../../global-state'

interface MockReachabilityStore {
  overrides: Map<string, boolean>
}

const store = globalState<MockReachabilityStore>('customMockReachability', () => {
  return { overrides: new Map() }
})

/** Dev-only switch: true forces ready, false forces unreachable. */
export function setMockReachable(id: string, isReachable: boolean): void {
  store.overrides.set(id, isReachable)
}

/** Override for one endpoint, or null when its id suffix drives the scenario. */
export function mockReachable(id: string): boolean | null {
  return store.overrides.get(id) ?? null
}

export function __resetMockReachabilityForTests(): void {
  store.overrides.clear()
}
