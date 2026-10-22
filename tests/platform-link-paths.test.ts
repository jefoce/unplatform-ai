import { describe, expect, it, vi } from 'vitest'

import type { UploadItem } from '@/core/types'

const mocks = vi.hoisted(() => ({ linkAbsPath: vi.fn(), toastError: vi.fn() }))

vi.mock('@/lib/platform/system-api', () => ({
  linkAbsPath: mocks.linkAbsPath,
  errorMessage: (error: unknown) => (error instanceof Error ? error.message : 'Request failed'),
}))

vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))

describe('linkPaths', () => {
  it('links 3 at a time and keeps successes after a failure', async () => {
    let active = 0
    let peak = 0

    mocks.linkAbsPath.mockImplementation(async (file: string) => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1

      if (file === 'bad') throw new Error('cannot link')

      return { id: file } as UploadItem
    })

    const { linkPaths } = await import('@/lib/platform/link-paths')
    const items = await linkPaths(['a', 'b', 'c', 'd', 'bad'])

    expect(peak).toBeLessThanOrEqual(3)
    expect(items.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(mocks.toastError).toHaveBeenCalledWith('cannot link')
  })
})
