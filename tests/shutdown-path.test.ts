import { describe, expect, it, vi } from 'vitest'

import { SHUTDOWN_IMAGE_WAIT_MS } from '../src/core/constants'

const mocks = vi.hoisted(() => {
  return {
    cancelActiveCustomImageJobs: vi.fn(async () => {}),
    exit: vi.fn(),
    flagUnfinishedImageCharges: vi.fn(async () => {}),
    releaseInstanceLock: vi.fn(),
    stopAllFfmpeg: vi.fn(),
    stopImageSubmits: vi.fn(),
    stopPoller: vi.fn(),
    stopSubmits: vi.fn(),
    waitForDownloadsDone: vi.fn(async () => {
      return true
    }),
    waitForImageSendingDone: vi.fn(async () => {
      return false
    }),
    waitForSendingDone: vi.fn(async () => {
      return true
    }),
  }
})

vi.mock('@/server/instance-lock', () => {
  return { releaseInstanceLock: mocks.releaseInstanceLock }
})

vi.mock('@/server/jobs/download-queue', () => {
  return { waitForDownloadsDone: mocks.waitForDownloadsDone }
})

vi.mock('@/server/jobs/image-reconcile', () => {
  return { flagUnfinishedImageCharges: mocks.flagUnfinishedImageCharges }
})

vi.mock('@/server/jobs/image-submit-queue', () => {
  return {
    stopImageSubmits: mocks.stopImageSubmits,
    waitForImageSendingDone: mocks.waitForImageSendingDone,
  }
})

vi.mock('@/server/jobs/poller', () => {
  return { stopPoller: mocks.stopPoller }
})

vi.mock('@/server/jobs/submit-queue', () => {
  return { stopSubmits: mocks.stopSubmits, waitForSendingDone: mocks.waitForSendingDone }
})

vi.mock('@/server/media/ffmpeg', () => {
  return { stopAllFfmpeg: mocks.stopAllFfmpeg }
})

vi.mock('@/server/providers/custom/image-jobs', () => {
  return { cancelActiveCustomImageJobs: mocks.cancelActiveCustomImageJobs }
})

const { shutdownServer } = await import('@/server/shutdown')

const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
  return undefined as never
})

describe('shutdown path', () => {
  it('stops queues, waits, releases the lock and exits once', async () => {
    await shutdownServer()
    await shutdownServer()

    expect(mocks.stopPoller).toHaveBeenCalledTimes(1)
    expect(mocks.stopSubmits).toHaveBeenCalledTimes(1)
    expect(mocks.stopImageSubmits).toHaveBeenCalledTimes(1)
    expect(mocks.cancelActiveCustomImageJobs).toHaveBeenCalledTimes(1)
    expect(mocks.waitForSendingDone).toHaveBeenCalledTimes(1)
    expect(mocks.waitForImageSendingDone).toHaveBeenCalledWith(SHUTDOWN_IMAGE_WAIT_MS)
    expect(mocks.waitForDownloadsDone).toHaveBeenCalledTimes(1)
    expect(mocks.flagUnfinishedImageCharges).toHaveBeenCalledTimes(1)
    expect(mocks.stopAllFfmpeg).toHaveBeenCalledTimes(1)
    expect(mocks.releaseInstanceLock).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledTimes(1)
  })
})
