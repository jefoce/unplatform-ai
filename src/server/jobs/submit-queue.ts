import 'server-only'

import { getGeneration, listGenerations } from '../repos/generations'
import { createSubmitQueue, type SubmitRunner, type SubmitStage } from './submit-queue-factory'

export interface SubmitQueueConfig {
  run: SubmitRunner
}

const queue = createSubmitQueue({
  key: 'submitQueue',
  load: (id) => {
    return getGeneration(id)
  },
  list: () => {
    return listGenerations()
  },
})

/** Wired in boot.ts, so this module never imports run-submit back. */
export function configureSubmitQueue(params: SubmitQueueConfig): void {
  const { run } = params

  queue.configure(run)
}

/** True while this process owns the submit: timer, queued or running. */
export function isSubmitOwned(id: string): boolean {
  return queue.isOwned(id)
}

/** Runs that already handed the request to the provider but await its reply. */
export function sendingCount(): number {
  return queue.sendingCount()
}

/** run-submit marks each phase so shutdown can tell uploads from sends. */
export function setSubmitStage(id: string, stage: SubmitStage | null): void {
  queue.setStage(id, stage)
}

/** True after shutdown stopped the queue. No new submit may start. */
export function isSubmitStopped(): boolean {
  return queue.isStopped()
}

/** Schedules an upload and submit after the grace window. */
export function startSubmit(id: string): Promise<void> {
  return queue.start(id)
}

/** Reschedules the remaining grace windows after a process restart. */
export function resumeGraceSubmits(): Promise<void> {
  return queue.resume()
}

/** Clears a scheduled grace timer so a canceled record never submits. */
export function cancelScheduledSubmit(id: string): void {
  queue.cancel(id)
}

/** Closes the queue, clears grace timers and aborts uploads. Sends finish. */
export function stopSubmits(): void {
  queue.stop()
}

/** Waits until no run is inside submitVideo, or the timeout expires. */
export function waitForSendingDone(timeoutMs: number): Promise<boolean> {
  return queue.waitForSendingDone(timeoutMs)
}
