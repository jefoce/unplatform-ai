'use client'

import { useEffect, useRef, useState } from 'react'

import type { ReferencePlan } from '@/core/media-types'
import { requestReferencePlan } from '@/lib/api/generations'

interface ImagePlanAnswer {
  key: string
  plan: ReferencePlan
}

/** Debounced share of the submit encoder. Stale answers for older lists are dropped. */
export function useImagePlan(presetId: string, ids: string[]): ReferencePlan | null {
  const [answer, setAnswer] = useState<ImagePlanAnswer | null>(null)
  const key = ids.join(',')
  const answerKey = `${presetId}:${key}`
  const latest = useRef(0)

  useEffect(() => {
    const sequence = ++latest.current

    if (key === '') {
      return
    }

    const timer = window.setTimeout(() => {
      void requestReferencePlan(presetId, key.split(','))
        .then((plan) => {
          if (sequence === latest.current) {
            setAnswer({ key: answerKey, plan })
          }
        })
        .catch(() => {})
    }, 400)

    return () => {
      window.clearTimeout(timer)
    }
  }, [presetId, key, answerKey])

  // A changed list or preset never shows the previous plan while the new one loads.
  if (answer?.key === answerKey) {
    return answer.plan
  }

  return null
}
