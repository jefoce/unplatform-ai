import { chunk } from 'lodash-es'

import { HISTORY_BATCH_MAX } from '@/core/constants'
import type { BatchSkip } from '@/core/types'
import { apiPost } from '@/lib/fetcher'

interface BatchResult {
  done: string[]
  skipped: BatchSkip[]
}

/** Runs the same batch action in chunks the server accepts. */
export async function batchAction(
  ids: string[],
  body: Record<string, unknown>,
): Promise<BatchResult> {
  const results = await Promise.all(
    chunk(ids, HISTORY_BATCH_MAX).map((part) =>
      apiPost<BatchResult>('/api/generations/batch', { ...body, ids: part }),
    ),
  )

  return {
    done: results.flatMap((result) => result.done),
    skipped: results.flatMap((result) => result.skipped),
  }
}
