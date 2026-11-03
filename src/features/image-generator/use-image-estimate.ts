'use client'

import { isNil } from 'lodash-es'
import useSWR from 'swr'
import { useShallow } from 'zustand/react/shallow'

import { imageEstimateBody } from '@/core/api/image'
import { PRICE_DEBOUNCE_MS } from '@/core/constants'
import type { PriceQuote } from '@/core/pricing/types'
import { fetchImageEstimate } from '@/lib/api/images'
import { type ImageEstimateKey, imageEstimateKey } from '@/lib/api/swr-keys'
import { useDebouncedValue } from '@/lib/use-debounced-value'

import { useImageGeneratorStore } from './store'

interface EstimateFields {
  usd: number | null
  isApproximate: boolean
}

/** Estimate fields for one quote, dropped when its key failed. */
function estimateFields(data: PriceQuote | undefined, isFailed: boolean): EstimateFields {
  if (isFailed) {
    return { usd: null, isApproximate: false }
  }

  return { usd: data?.usd ?? null, isApproximate: data?.isApproximate ?? false }
}

/** Server estimate for the current image draft. */
export function useImageEstimate(isEnabled: boolean) {
  const draft = useImageGeneratorStore(
    useShallow((state) => {
      return {
        presetId: state.presetId,
        prompt: state.prompt,
        count: state.count,
        aspectRatio: state.aspectRatio,
        resolution: state.resolution,
        quality: state.quality,
        background: state.background,
        references: state.references,
        seed: state.seed,
      }
    }),
  )

  const json = JSON.stringify(imageEstimateBody({ ...draft }))
  const debouncedJson = useDebouncedValue(json, PRICE_DEBOUNCE_MS)
  let key: ImageEstimateKey | null = null

  if (isEnabled) {
    key = imageEstimateKey(debouncedJson)
  }

  const { data, error, isLoading } = useSWR<PriceQuote>(key, fetchImageEstimate, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
  })

  return {
    ...estimateFields(data, !isNil(error)),
    isLoading: isEnabled && (json !== debouncedJson || isLoading),
  }
}
