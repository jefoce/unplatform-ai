import { chunk } from 'lodash-es'

import { HISTORY_BATCH_MAX } from '@/core/constants'
import type { Dict } from '@/core/utility-types'
import { batchGenerations, type BatchResult } from '@/lib/api/generations'

/** Runs the same batch action in chunks the server accepts. */
export async function batchAction(ids: string[], body: Dict<unknown>): Promise<BatchResult> {
  const results = await Promise.all(
    chunk(ids, HISTORY_BATCH_MAX).map((part) => {
      return batchGenerations(part, body)
    }),
  )

  return {
    done: results.flatMap((result) => {
      return result.done
    }),
    skipped: results.flatMap((result) => {
      return result.skipped
    }),
  }
}
