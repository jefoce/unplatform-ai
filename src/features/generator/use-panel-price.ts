'use client'

import { useEffect, useState } from 'react'
import { omit } from 'lodash-es'
import useSWR from 'swr'
import { useShallow } from 'zustand/react/shallow'

import { inputForSubmit } from '@/core/normalize-input'
import type { GenerationEstimate, GenerationInput } from '@/core/types'
import { apiPost } from '@/lib/fetcher'
import { generationEstimateKey } from '@/lib/swr-keys'

import { useGeneratorStore } from './store'

const DEBOUNCE_MS = 500

type EstimateKey = readonly [string, string]

type PriceDraft = Omit<GenerationInput, 'prompt' | 'seed'>

/** Serialized key stays until the draft stops changing. */
function useDebouncedJson(json: string): string {
  const [debouncedJson, setDebouncedJson] = useState(json)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedJson(json), DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [json])

  return debouncedJson
}

async function fetchEstimate([url, json]: EstimateKey): Promise<GenerationEstimate> {
  return apiPost<GenerationEstimate>(url, JSON.parse(json) as unknown)
}

/** Price-only body. Prompt and seed never reach the estimate key. */
function priceJson(draft: PriceDraft): string {
  const full = inputForSubmit({ ...draft, prompt: '', seed: null })

  return JSON.stringify(omit(full, ['prompt', 'seed']))
}

/** Server price for the current draft, with the list price when discounted. */
export function usePanelPrice() {
  const draft = useGeneratorStore(
    useShallow((state) => ({
      presetId: state.presetId,
      tab: state.tab,
      audio: state.audio,
      duration: state.duration,
      aspectRatio: state.aspectRatio,
      resolution: state.resolution,
      frames: state.frames,
      references: state.references,
    })),
  )
  const json = priceJson(draft)
  const debouncedJson = useDebouncedJson(json)
  const { data, isLoading } = useSWR<GenerationEstimate>(
    generationEstimateKey(debouncedJson),
    fetchEstimate,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      keepPreviousData: true,
      shouldRetryOnError: false,
    },
  )
  const isDebouncePending = json !== debouncedJson

  return {
    price: data?.estimatedUsd ?? null,
    listPrice: data?.listUsd ?? null,
    discount: data?.discount ?? 0,
    isLoading: isDebouncePending || isLoading,
  }
}
