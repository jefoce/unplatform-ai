'use client'

import { useCallback } from 'react'
import { Diamond } from 'lucide-react'

import { getPreset, type Resolution } from '@/core/presets'
import { pricePerSec } from '@/core/pricing'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'

import { ResolutionOption } from './ResolutionOption'
import { useGeneratorStore } from './store'
import { usePricing } from './use-pricing'

/** Resolution button and preset list with list and discounted per-second rates. */
export function ResolutionPopover() {
  const resolution = useGeneratorStore((state) => state.resolution)
  const setResolution = useGeneratorStore((state) => state.setResolution)
  const isAudio = useGeneratorStore((state) => state.audio)
  const aspect = useGeneratorStore((state) => state.aspectRatio)
  const hasVideoInput = useGeneratorStore(
    (state) =>
      state.tab === 'references' &&
      state.references.some((id) => state.uploadsById[id]?.kind === 'video'),
  )
  const preset = getPreset(useGeneratorStore((state) => state.presetId))
  const { pricing } = usePricing()
  const discount = pricing?.discount ?? 0
  const handleSelectResolution = useCallback(
    (option: Resolution): void => setResolution(option),
    [setResolution],
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 flex-1 items-center gap-1 rounded-md bg-surface px-3 text-sm font-medium text-fg hover:bg-white/6"
        >
          <Diamond size={16} />
          {resolution}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 space-y-1">
        {preset.resolutions.map((option) => {
          const ctx = { resolution: option, aspect, audio: isAudio, hasVideoInput }
          const rate = pricePerSec({ preset, ctx, skus: pricing?.skus })
          let listRate: number | null = null

          if (discount > 0) listRate = pricePerSec({ preset, ctx, skus: pricing?.listSkus })

          return (
            <ResolutionOption
              key={option}
              option={option}
              isSelected={option === resolution}
              rate={rate}
              listRate={listRate}
              discount={discount}
              onSelect={handleSelectResolution}
            />
          )
        })}
        {pricing?.source === 'fallback' && (
          <p className="px-2 pb-1 text-xxs text-fg-2">Saved rates, live price unavailable</p>
        )}
      </PopoverContent>
    </Popover>
  )
}
