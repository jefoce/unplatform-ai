'use client'

import { useMemo } from 'react'
import { isNil } from 'lodash-es'

const PRICE_LOADING_REASON = 'Getting price'
const PRICE_UNAVAILABLE_REASON = 'Price unavailable'

export interface SubmitGateParams {
  isValid: boolean
  isReady: boolean
  isAtLimit: boolean
  isPriceLoading: boolean
  price: number | null
  limitMessage?: string
}

export interface SubmitGate {
  canSubmit: boolean
  reason: string | null
}

/** True for the price reasons this gate reports. Invalid and provider reasons stay null. */
export function isPriceReason(reason: string | null): boolean {
  return reason === PRICE_LOADING_REASON || reason === PRICE_UNAVAILABLE_REASON
}

function gateReason(params: SubmitGateParams): string | null {
  const { isValid, isReady, isAtLimit, isPriceLoading, price, limitMessage } = params

  if (!isValid || !isReady) {
    return null
  }

  if (isAtLimit) {
    return limitMessage ?? null
  }

  if (isPriceLoading) {
    return PRICE_LOADING_REASON
  }

  if (isNil(price)) {
    return PRICE_UNAVAILABLE_REASON
  }

  return null
}

/** One submit decision for the button, the keyboard and the submit action. */
export function useSubmitGate(params: SubmitGateParams): SubmitGate {
  const { isValid, isReady, isAtLimit, isPriceLoading, price, limitMessage } = params

  return useMemo(() => {
    const canSubmit = isValid && isReady && !isAtLimit && !isPriceLoading && !isNil(price)

    return {
      canSubmit,
      reason: gateReason({ isValid, isReady, isAtLimit, isPriceLoading, price, limitMessage }),
    }
  }, [isAtLimit, isPriceLoading, isReady, isValid, limitMessage, price])
}
