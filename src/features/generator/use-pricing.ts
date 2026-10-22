'use client'

import useSWR from 'swr'

import type { PricingInfo } from '@/core/types'
import { fetcher } from '@/lib/fetcher'

import { useGeneratorStore } from './store'

/** Live SKU prices for the draft preset, refreshed hourly. Pass an id to price another model. */
export function usePricing(presetIdOverride?: string) {
  const storePresetId = useGeneratorStore((state) => state.presetId)
  const presetId = presetIdOverride ?? storePresetId
  const { data: pricing } = useSWR<PricingInfo>(
    `/api/pricing?preset=${encodeURIComponent(presetId)}`,
    fetcher,
    { refreshInterval: 3_600_000 },
  )

  return { pricing }
}
