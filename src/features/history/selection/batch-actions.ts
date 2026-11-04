import { chunk } from 'lodash-es'

import type { ImageBatchBody, ImageOutputRef } from '@/core/api/image'
import type { BatchResult, GenerationBatchBody } from '@/core/api/video'
import { HISTORY_BATCH_MAX } from '@/core/constants'
import { batchGenerations } from '@/lib/api/generations'
import { batchImageOutputs } from '@/lib/api/images'

/** Runs one sender over chunks the server accepts and merges the results. */
async function runBatches<T>(
  items: T[],
  send: (part: T[]) => Promise<BatchResult>,
): Promise<BatchResult> {
  const results = await Promise.all(chunk(items, HISTORY_BATCH_MAX).map(send))

  return {
    done: results.flatMap((result) => {
      return result.done
    }),
    skipped: results.flatMap((result) => {
      return result.skipped
    }),
  }
}

/** Runs the same video batch action in chunks the server accepts. */
export function batchAction(ids: string[], body: GenerationBatchBody): Promise<BatchResult> {
  return runBatches(ids, (part) => {
    return batchGenerations(part, body)
  })
}

/** Runs the same image batch action in chunks the server accepts. */
export function batchImageAction(
  outputs: ImageOutputRef[],
  body: Omit<ImageBatchBody, 'outputs'>,
): Promise<BatchResult> {
  return runBatches(outputs, (part) => {
    return batchImageOutputs({ ...body, outputs: part })
  })
}
