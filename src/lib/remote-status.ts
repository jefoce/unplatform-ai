import { mutate } from 'swr'

import { REMOTE_STATUS_KEY } from '@/lib/swr-keys'

/** Revalidates the remote status after storage keys change. */
export async function refreshRemoteStatus(): Promise<void> {
  await mutate(REMOTE_STATUS_KEY)
}
