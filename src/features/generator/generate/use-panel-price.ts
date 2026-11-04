'use client'

import { isNil, omit } from 'lodash-es'
import useSWR from 'swr'
import { useShallow } from 'zustand/react/shallow'

import type { GenerationEstimate } from '@/core/api/video'
import { PRICE_DEBOUNCE_MS } from '@/core/constants'
import { inputForSubmit } from '@/core/normalize-input'
import type { GenerationInput } from '@/core/schemas/generation-record'
import { fetchEstimate } from '@/lib/api/generations'
import { generationEstimateKey } from '@/lib/api/swr-keys'
import { useDebouncedValue } from '@/lib/use-debounced-value'

import { useGeneratorStore } from '../store/store'

type PriceDraft = Omit<GenerationInput, 'prompt' | 'seed'>

interface PriceFields {
  price: number | null
  listPrice: number | null
  discount: number
}

/** Price-only body. Prompt and seed never reach the estimate key. */
function priceJson(draft: PriceDraft): string {
  const full = inputForSubmit({ ...draft, prompt: '', seed: null })

  return JSON.stringify(omit(full, ['prompt', 'seed']))
}

/** Price fields for one quote, dropped when its key failed. */
function priceFields(data: GenerationEstimate | undefined, isFailed: boolean): PriceFields {
  if (isFailed) {
    return { price: null, listPrice: null, discount: 0 }
  }

  return {
    price: data?.estimatedUsd ?? null,
    listPrice: data?.listUsd ?? null,
    discount: data?.discount ?? 0,
  }
}

/** Server price for the current draft, with the list price when discounted. */
export function usePanelPrice(isEnabled: boolean) {
  const draft = useGeneratorStore(
    useShallow((state) => {
      return {
        presetId: state.presetId,
        tab: state.tab,
        audio: state.audio,
        duration: state.duration,
        aspectRatio: state.aspectRatio,
        resolution: state.resolution,
        frames: state.frames,
        references: state.references,
      }
    }),
  )

  const json = priceJson(draft)
  const debouncedJson = useDebouncedValue(json, PRICE_DEBOUNCE_MS)

  const estimateKey = generationEstimateKey(debouncedJson)
  const key = isEnabled ? estimateKey : null

  const { data, error, isLoading } = useSWR<GenerationEstimate>(key, fetchEstimate, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    keepPreviousData: true,
    shouldRetryOnError: false,
  })

  const isDebouncePending = json !== debouncedJson

  return {
    ...priceFields(data, !isNil(error)),
    isLoading: isEnabled && (isDebouncePending || isLoading),
  }
}
