import 'server-only'

import { getImage, listImages } from '../repos/images'
import { createSubmitQueue, type SubmitRunner, type SubmitStage } from './submit-queue-factory'

export interface ImageSubmitQueueConfig {
  run: SubmitRunner
}

const queue = createSubmitQueue({
  key: 'imageSubmitQueue',
  load: (id) => {
    return getImage(id)
  },
  list: () => {
    return listImages()
  },
})

/** Wired in boot.ts, so this module never imports the image runner back. */
export function configureImageSubmitQueue(params: ImageSubmitQueueConfig): void {
  const { run } = params

  queue.configure(run)
}

export function isImageSubmitOwned(id: string): boolean {
  return queue.isOwned(id)
}

/** Calls that already handed the request to the provider but await its reply. */
export function imageSendingCount(): number {
  return queue.sendingCount()
}

export function setImageSubmitStage(id: string, stage: SubmitStage | null): void {
  queue.setStage(id, stage)
}

export function isImageSubmitStopped(): boolean {
  return queue.isStopped()
}

export function startImageSubmit(id: string): Promise<void> {
  return queue.start(id)
}

export function resumeImageSubmits(): Promise<void> {
  return queue.resume()
}

export function cancelScheduledImageSubmit(id: string): void {
  queue.cancel(id)
}

/** Closes the queue, clears grace timers and aborts encoding. Calls finish. */
export function stopImageSubmits(): void {
  queue.stop()
}

export function waitForImageSendingDone(timeoutMs: number): Promise<boolean> {
  return queue.waitForSendingDone(timeoutMs)
}
