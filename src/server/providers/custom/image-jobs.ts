import 'server-only'

import { globalState } from '../../global-state'

type CancelJob = () => Promise<void>

interface ShutdownFlag {
  value: boolean
}

const active = globalState<Map<string, CancelJob>>('customImageJobs', () => {
  return new Map()
})

const registered = globalState<ShutdownFlag>('customImageShutdown', () => {
  return { value: false }
})

export function trackCustomImageJob(jobId: string, cancel: CancelJob): void {
  active.set(jobId, cancel)
}

export function untrackCustomImageJob(jobId: string): void {
  active.delete(jobId)
}

/** Best effort: a process signal cancels the queued ComfyUI jobs. */
async function cancelActiveCustomImageJobs(): Promise<void> {
  const jobs = [...active.values()]

  active.clear()

  await Promise.all(
    jobs.map((cancel) => {
      return cancel().catch(() => {})
    }),
  )
}

export function registerCustomImageShutdown(): void {
  if (registered.value) {
    return
  }

  registered.value = true

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void cancelActiveCustomImageJobs()
    })
  }
}
