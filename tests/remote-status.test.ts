import { describe, expect, it, vi } from 'vitest'

import { refreshRemoteStatus } from '@/lib/remote-status'
import { REMOTE_STATUS_KEY } from '@/lib/swr-keys'

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }))

vi.mock('swr', () => ({ default: vi.fn(), mutate }))

describe('refreshRemoteStatus', () => {
  it('revalidates the remote status key', async () => {
    await refreshRemoteStatus()

    expect(mutate).toHaveBeenCalledWith(REMOTE_STATUS_KEY)
  })
})
