import 'server-only'

import {
  SHUTDOWN_DOWNLOAD_WAIT_MS,
  SHUTDOWN_IMAGE_WAIT_MS,
  SHUTDOWN_SEND_WAIT_MS,
} from '@/core/constants'

import { releaseInstanceLock } from './instance-lock'
import { waitForDownloadsDone } from './jobs/download-queue'
import { flagUnfinishedImageCharges } from './jobs/image-reconcile'
import { stopImageSubmits, waitForImageSendingDone } from './jobs/image-submit-queue'
import { stopPoller } from './jobs/poller'
import { stopSubmits, waitForSendingDone } from './jobs/submit-queue'
import { stopAllFfmpeg } from './media/ffmpeg'
import { cancelActiveCustomImageJobs } from './providers/custom/image-jobs'

let isShuttingDown = false

/** Stops new work, waits for sends and downloads, then exits. Repeat calls are no-ops. */
export async function shutdownServer(): Promise<void> {
  if (isShuttingDown) {
    return
  }

  isShuttingDown = true

  stopPoller()
  stopSubmits()
  stopImageSubmits()

  await cancelActiveCustomImageJobs()

  const [isImageDone] = await Promise.all([
    waitForImageSendingDone(SHUTDOWN_IMAGE_WAIT_MS),
    waitForSendingDone(SHUTDOWN_SEND_WAIT_MS),
    waitForDownloadsDone(SHUTDOWN_DOWNLOAD_WAIT_MS),
  ])

  if (!isImageDone) {
    await flagUnfinishedImageCharges()
  }

  stopAllFfmpeg()
  releaseInstanceLock()
  process.exit(0)
}

/** SIGINT and SIGTERM take the same path as the shutdown route. */
export function registerShutdownSignals(): void {
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void shutdownServer()
    })
  }
}
