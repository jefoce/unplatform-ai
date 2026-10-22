'use client'

import { useEffect, useRef, useState } from 'react'

import type { ReferencePlan } from '@/core/types'
import { apiPost } from '@/lib/fetcher'

/** Debounced share of the submit encoder. Stale answers for older lists are dropped. */
export function useImagePlan(presetId: string, ids: string[]): ReferencePlan | null {
  const [answer, setAnswer] = useState<{ key: string; plan: ReferencePlan } | null>(null)
  const key = ids.join(',')
  const answerKey = `${presetId}:${key}`
  const latest = useRef(0)

  useEffect(() => {
    const sequence = ++latest.current

    if (key === '') return

    const timer = window.setTimeout(() => {
      void apiPost<ReferencePlan>('/api/references/plan', {
        presetId,
        ids: key.split(','),
      })
        .then((plan) => {
          if (sequence === latest.current) setAnswer({ key: answerKey, plan })
        })
        .catch(() => {})
    }, 400)

    return () => window.clearTimeout(timer)
  }, [presetId, key, answerKey])

  // A changed list or preset never shows the previous plan while the new one loads.
  return answer?.key === answerKey ? answer.plan : null
}
