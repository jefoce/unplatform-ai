import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    ensureDirs: vi.fn(async () => {}),
    reconcile: vi.fn(async () => {}),
    stopDownloads: vi.fn(),
  }
})

vi.mock('@/server/paths', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()

  return {
    ...actual,
    cleanupStale: async () => {},
    ensureDirs: mocks.ensureDirs,
  }
})

vi.mock('@/server/media/ffmpeg', () => {
  return {
    assertFfmpeg: () => {
      return {}
    },
  }
})

vi.mock('@/server/jobs/reconcile', () => {
  return {
    interruptText: () => {
      return ''
    },
    needsInterruptFail: () => {
      return false
    },
    reconcile: mocks.reconcile,
  }
})

vi.mock('@/server/jobs/download-queue', () => {
  return {
    isDownloadQueued: () => {
      return false
    },
    stopDownloads: mocks.stopDownloads,
  }
})

const { emitJobSent, onJobSent } = await import('@/server/jobs/job-events')
const { isBooted, startPoller, stopPoller } = await import('@/server/jobs/poller')

describe('poller after shutdown', () => {
  it('never starts again, even from a job sent event', async () => {
    onJobSent(startPoller)

    stopPoller()
    emitJobSent('job-1')
    startPoller()
    await Promise.resolve()

    expect(mocks.ensureDirs).not.toHaveBeenCalled()
    expect(mocks.reconcile).not.toHaveBeenCalled()
    expect(isBooted()).toBe(false)
  })
})
