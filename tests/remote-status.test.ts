import { describe, expect, it, vi } from 'vitest'

import { refreshRemoteStatus } from '@/lib/api/remote'
import { REMOTE_STATUS_KEY } from '@/lib/swr-keys'

const { mutate } = vi.hoisted(() => {
  return { mutate: vi.fn() }
})

vi.mock('swr', () => {
  return { default: vi.fn(), mutate }
})

describe('refreshRemoteStatus', () => {
  it('revalidates the remote status key', async () => {
    await refreshRemoteStatus()

    expect(mutate).toHaveBeenCalledWith(REMOTE_STATUS_KEY)
  })
})
