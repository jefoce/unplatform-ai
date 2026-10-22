import 'server-only'

import { isNil } from 'lodash-es'

import { isStaleGrace } from '@/core/submit-state'
import type { GenerationRecord } from '@/core/types'

import { getGeneration, listGenerations, saveGeneration } from '../repos/generations'
import { withLock } from './lock'
import { isSubmitOwned, resumeGraceSubmits } from './submit-queue'

export const GRACE_EXPIRED_TEXT = 'Not started: the app was closed before it was sent'

const INTERRUPT_TEXT = {
  uploading: 'Interrupted while uploading inputs',
  sending: 'Interrupted while sending. Check OpenRouter activity before rerun, the job may exist.',
} as const

/** Cancels stale grace records, resumes fresh ones, fails orphaned submits. */
export async function reconcile(): Promise<void> {
  for (const record of await listGenerations()) {
    if (!isStaleGrace(record)) continue

    await withLock(record.id, async () => {
      const current = await getGeneration(record.id)

      if (!current || !isStaleGrace(current)) return

      await saveGeneration({
        ...current,
        status: 'cancelled',
        error: GRACE_EXPIRED_TEXT,
        submit: undefined,
      })
    })
  }

  await resumeGraceSubmits()

  for (const record of await listGenerations()) {
    if (record.status === 'submitting' && record.submit?.stage === 'grace') continue

    if (!needsInterruptFail(record)) continue

    await withLock(record.id, async () => {
      const current = await getGeneration(record.id)

      if (!current || !needsInterruptFail(current)) return

      await saveGeneration({
        ...current,
        status: 'failed',
        error: interruptText(current),
        submit: undefined,
      })
    })
  }
}

/** True when a submit has no live owner in this process. */
export function needsInterruptFail(record: GenerationRecord): boolean {
  const stage = record.submit?.stage

  return (
    record.status === 'submitting' &&
    (isNil(record.job) || record.job.id === '') &&
    (stage === 'uploading' || stage === 'sending') &&
    !isSubmitOwned(record.id)
  )
}

export function interruptText(record: GenerationRecord): string {
  return INTERRUPT_TEXT[record.submit?.stage === 'sending' ? 'sending' : 'uploading']
}
