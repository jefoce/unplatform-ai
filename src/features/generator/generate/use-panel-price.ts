'use client'

import { omit } from 'lodash-es'
import useSWR from 'swr'
import { useShallow } from 'zustand/react/shallow'

import { inputForSubmit } from '@/core/normalize-input'
import type { GenerationInput } from '@/core/schemas/generation-record'
import type { GenerationEstimate } from '@/core/types'
import { fetchEstimate } from '@/lib/api/generations'
import { generationEstimateKey } from '@/lib/swr-keys'
import { useDebouncedValue } from '@/lib/use-debounced-value'

import { useGeneratorStore } from '../store/store'

const DEBOUNCE_MS = 500

type PriceDraft = Omit<GenerationInput, 'prompt' | 'seed'>

/** Price-only body. Prompt and seed never reach the estimate key. */
function priceJson(draft: PriceDraft): string {
  const full = inputForSubmit({ ...draft, prompt: '', seed: null })

  return JSON.stringify(omit(full, ['prompt', 'seed']))
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
  const debouncedJson = useDebouncedValue(json, DEBOUNCE_MS)

  const estimateKey = generationEstimateKey(debouncedJson)
  const key = isEnabled ? estimateKey : null

  const { data, isLoading } = useSWR<GenerationEstimate>(key, fetchEstimate, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    keepPreviousData: true,
    shouldRetryOnError: false,
  })

  const isDebouncePending = json !== debouncedJson

  return {
    price: data?.estimatedUsd ?? null,
    listPrice: data?.listUsd ?? null,
    discount: data?.discount ?? 0,
    isLoading: isEnabled && (isDebouncePending || isLoading),
  }
}
