import 'server-only'

import { globalState } from '../global-state'

type JobSentListener = (id: string) => void

const listeners = globalState<Set<JobSentListener>>('jobEvents', () => {
  return new Set()
})

/** Registers a listener that runs after a submitted job is saved. */
export function onJobSent(listener: JobSentListener): void {
  listeners.add(listener)
}

/** Tells every listener a job was saved. A failing listener never blocks the rest. */
export function emitJobSent(id: string): void {
  for (const listener of listeners) {
    try {
      listener(id)
    } catch (error) {
      console.error('[unplatform-ai] job sent listener failed', error)
    }
  }
}
