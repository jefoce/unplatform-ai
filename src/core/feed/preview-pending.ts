import { isNil } from 'lodash-es'

import { PREVIEW_GRACE_MS } from '../constants'
import type { GenerationRecord } from '../schemas/generation-record'

/** True while a just-finished video may still gain its poster. */
export function isPreviewPending(record: GenerationRecord, now = Date.now()): boolean {
  if (record.status !== 'completed') {
    return false
  }

  if (!isNil(record.output?.preview)) {
    return false
  }

  if (record.previewPending === false) {
    return false
  }

  return now - Date.parse(record.updatedAt) < PREVIEW_GRACE_MS
}
