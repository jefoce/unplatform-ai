'use client'

import { isNil } from 'lodash-es'
import { Monitor } from 'lucide-react'

import { getPreset } from '@/core/presets'
import { resolutionDisplay, videoResolutionChoices } from '@/core/presets/common/display'
import { pricePerSec } from '@/core/pricing/quote'
import { useModelEntry } from '@/lib/api/catalog'
import { cn } from '@/lib/cn'
import { CHIP_TEXT_CLASSES } from '@/ui/Chip'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'

import { useGeneratorStore } from '../store/store'
import { hasVideoReference } from '../store/store-helpers'
import { ResolutionOption } from './ResolutionOption'

/** Resolution button and preset list with list and discounted per-second rates. */
export function ResolutionPopover() {
  const resolution = useGeneratorStore((state) => {
    return state.resolution
  })

  const setResolution = useGeneratorStore((state) => {
    return state.setResolution
  })

  const isAudio = useGeneratorStore((state) => {
    return state.audio
  })

  const aspect = useGeneratorStore((state) => {
    return state.aspectRatio
  })

  const hasVideoInput = useGeneratorStore(hasVideoReference)

  const preset = getPreset(
    useGeneratorStore((state) => {
      return state.presetId
    }),
  )

  const pricing = useModelEntry(preset.id)?.pricing
  const discount = pricing?.discount ?? 0
  const selected = resolutionDisplay(preset, { resolution, aspect })
  const choices = videoResolutionChoices(preset, aspect)

  const handleSelectResolution = (option: string): void => {
    setResolution(option)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-10 flex-1 items-center gap-1 rounded-md bg-surface px-3 text-fg hover:bg-white/6',
            CHIP_TEXT_CLASSES,
          )}
        >
          <Monitor size={16} />
          {selected.label}
          {!isNil(selected.detail) && <span className="text-xs text-fg-2">{selected.detail}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 space-y-1">
        {choices.map((choice) => {
          const ctx = {
            resolution: choice.value,
            aspect,
            audio: isAudio,
            hasVideoInput,
          }

          const rate = pricePerSec({ preset, ctx, skus: pricing?.skus })
          let listRate: number | null = null

          if (discount > 0) {
            listRate = pricePerSec({ preset, ctx, skus: pricing?.listSkus })
          }

          return (
            <ResolutionOption
              key={choice.value}
              option={choice.value}
              label={choice.label}
              detail={choice.detail}
              isSelected={choice.value === resolution}
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
