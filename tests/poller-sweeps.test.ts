import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    sweepRemote: vi.fn(async () => {
      return { deleted: 0, cleared: 0 }
    }),
    sweepCompatFiles: vi.fn(async () => {
      return 0
    }),
    sweepThumbs: vi.fn(async () => {
      return 0
    }),
  }
})

vi.mock('@/server/services/remote-inputs', () => {
  return { sweepRemote: mocks.sweepRemote }
})

vi.mock('@/server/media/compat', () => {
  return { sweepCompatFiles: mocks.sweepCompatFiles }
})

vi.mock('@/server/media/thumbs', () => {
  return { sweepThumbs: mocks.sweepThumbs }
})

vi.mock('@/server/media/ffmpeg', () => {
  return { assertFfmpeg: vi.fn() }
})

const { runSweeps } = await import('@/server/jobs/poller')

describe('runSweeps', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('still runs the thumbs sweep when the compat sweep throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    mocks.sweepCompatFiles.mockRejectedValueOnce(new Error('compat boom'))
    mocks.sweepThumbs.mockResolvedValueOnce(2)

    await expect(runSweeps()).resolves.toEqual({
      deleted: 0,
      cleared: 0,
      compat: 0,
      thumbs: 2,
    })

    expect(mocks.sweepRemote).toHaveBeenCalledTimes(1)
    expect(mocks.sweepThumbs).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith('[unplatform-ai] compat sweep failed', expect.any(Error))
  })

  it('keeps the counts from the sweeps that succeeded', async () => {
    mocks.sweepRemote.mockResolvedValueOnce({ deleted: 3, cleared: 1 })
    mocks.sweepCompatFiles.mockResolvedValueOnce(4)
    mocks.sweepThumbs.mockResolvedValueOnce(5)

    await expect(runSweeps()).resolves.toEqual({
      deleted: 3,
      cleared: 1,
      compat: 4,
      thumbs: 5,
    })
  })
})
