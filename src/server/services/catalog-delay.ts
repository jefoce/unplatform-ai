import 'server-only'

import { globalState } from '../global-state'

interface CatalogDelayState {
  ms: number
}

const state = globalState<CatalogDelayState>('catalogDelay', () => {
  return { ms: 0 }
})

/** Dev-only delay applied before the catalog response. */
export function setCatalogDelay(ms: number): void {
  state.ms = ms
}

/** Waits for the configured catalog delay, if any. */
export async function delayCatalog(): Promise<void> {
  if (state.ms <= 0) {
    return
  }

  await new Promise((resolve) => {
    setTimeout(resolve, state.ms)
  })
}
