// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useUploadQueue } from '@/features/media-picker/uploads/use-upload-queue'

const mocks = vi.hoisted(() => {
  return {
    uploadFilesWithProgress: vi.fn(),
  }
})

vi.mock('@/lib/api/uploads', () => {
  return { uploadFilesWithProgress: mocks.uploadFilesWithProgress }
})

interface UploadCall {
  signal: AbortSignal
}

function signalOf(index: number): AbortSignal {
  const call = mocks.uploadFilesWithProgress.mock.calls[index]?.[0] as UploadCall | undefined

  if (!call) {
    throw new Error(`Missing upload call ${index}`)
  }

  return call.signal
}

function makeFile(name: string): File {
  return new File(['bytes'], name, { type: 'image/png' })
}

interface DeferredUpload {
  promise: Promise<unknown[]>
  release: () => void
}

function noop(): void {}

function deferredUpload(): DeferredUpload {
  let release = noop

  const promise = new Promise<unknown[]>((resolve) => {
    release = () => {
      resolve([])
    }
  })

  return { promise, release }
}

beforeEach(() => {
  mocks.uploadFilesWithProgress.mockReset()

  mocks.uploadFilesWithProgress.mockImplementation(() => {
    return new Promise(() => {})
  })
})

afterEach(() => {
  cleanup()
})

describe('upload queue attempts', () => {
  it('aborts the previous attempt when the same upload is retried', async () => {
    const { result } = renderHook(() => {
      return useUploadQueue(vi.fn())
    })

    act(() => {
      result.current.enqueue([makeFile('a.png')])
    })

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1)
    })

    const id = result.current.items[0]?.id ?? ''
    const first = signalOf(0)

    act(() => {
      result.current.retry(id)
    })

    expect(mocks.uploadFilesWithProgress).toHaveBeenCalledTimes(2)
    expect(first.aborted).toBe(true)

    const second = signalOf(1)

    act(() => {
      result.current.clear()
    })

    expect(second.aborted).toBe(true)
  })

  it('aborts the attempt when its row is dismissed', async () => {
    const { result } = renderHook(() => {
      return useUploadQueue(vi.fn())
    })

    act(() => {
      result.current.enqueue([makeFile('c.png')])
    })

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1)
    })

    const id = result.current.items[0]?.id ?? ''
    const signal = signalOf(0)

    act(() => {
      result.current.dismiss(id)
    })

    expect(signal.aborted).toBe(true)
    expect(result.current.items).toHaveLength(0)
  })

  it('aborts every active attempt on unmount', async () => {
    const { result, unmount } = renderHook(() => {
      return useUploadQueue(vi.fn())
    })

    act(() => {
      result.current.enqueue([makeFile('b.png')])
    })

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1)
    })

    const signal = signalOf(0)

    unmount()

    expect(signal.aborted).toBe(true)
  })
})

describe('cancelled upload queue', () => {
  it('skips an upload cancelled before the chain reaches it', async () => {
    const upload = deferredUpload()

    mocks.uploadFilesWithProgress.mockReturnValue(upload.promise)

    const { result } = renderHook(() => {
      return useUploadQueue(vi.fn())
    })

    act(() => {
      result.current.enqueue([makeFile('a.png'), makeFile('b.png')])
    })

    await waitFor(() => {
      expect(mocks.uploadFilesWithProgress).toHaveBeenCalledTimes(1)
    })

    const cancelledId = result.current.items[1]?.id ?? ''

    act(() => {
      result.current.dismiss(cancelledId)
    })

    act(() => {
      upload.release()
    })

    await waitFor(() => {
      expect(result.current.items).toHaveLength(0)
    })

    expect(mocks.uploadFilesWithProgress).toHaveBeenCalledTimes(1)
  })
})
