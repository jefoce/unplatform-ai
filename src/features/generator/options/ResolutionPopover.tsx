'use client'

import { isNil } from 'lodash-es'
import { Monitor } from 'lucide-react'

import { getPreset } from '@/core/presets'
import { primaryBinding } from '@/core/presets/common/bindings'
import {
  resolutionDisplay,
  resolutionHeight,
  videoResolutionChoices,
} from '@/core/presets/common/display'
import type { VideoPreset } from '@/core/presets/video/types'
import { pricePerSec } from '@/core/pricing/quote'
import type { PricingInfo } from '@/core/pricing/types'
import { showPrice } from '@/core/pricing/visibility'
import type { Dict } from '@/core/utility-types'
import { useModelEntry } from '@/lib/api/catalog'
import { cn } from '@/lib/cn'
import { CHIP_TEXT_CLASSES } from '@/ui/Chip'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'

import { useGeneratorStore } from '../store/store'
import { hasVideoReference } from '../store/store-helpers'
import { ResolutionOption } from './ResolutionOption'

interface ChoiceRateParams {
  preset: VideoPreset
  resolution: string
  aspect: string
  isAudio: boolean
  hasVideoInput: boolean
  skus: Dict<number> | undefined
  listSkus: Dict<number> | undefined
  discount: number
}

interface ChoiceRate {
  rate: number | null
  listRate: number | null
}

function choiceRate(params: ChoiceRateParams): ChoiceRate {
  const { preset, resolution, aspect, isAudio, hasVideoInput, skus, listSkus, discount } = params
  const ctx = { resolution, aspect, audio: isAudio, hasVideoInput }
  const rate = pricePerSec({ preset, ctx, skus })
  let listRate: number | null = null

  if (discount > 0) {
    listRate = pricePerSec({ preset, ctx, skus: listSkus })
  }

  return { rate, listRate }
}

/** Custom models hide a zero per-run price, API models always show. */
function showsResolutionRates(
  preset: VideoPreset,
  pricing: PricingInfo | null | undefined,
): boolean {
  const usd = pricing?.skus.per_run ?? primaryBinding(preset).pricing.fallback.per_run ?? 0

  return preset.family !== 'custom' || showPrice({ local: true }, usd)
}

/** The fallback note only makes sense next to a visible rate column. */
function showsFallbackFooter(
  isRateShown: boolean,
  pricing: PricingInfo | null | undefined,
): boolean {
  return isRateShown && pricing?.source === 'fallback'
}

/** Resolution button and preset list with list and discounted per-second rates. */
/* eslint-disable-next-line max-lines-per-function -- one popover owns its rows, rate column and footer */
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
  const compact = resolutionHeight(preset, { resolution, aspect })
  const choices = videoResolutionChoices(preset, aspect)
  const isRateShown = showsResolutionRates(preset, pricing)

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
          {isNil(compact) && selected.label}
          {isNil(compact) && !isNil(selected.detail) && (
            <span className="text-xs text-fg-2">{selected.detail}</span>
          )}
          {!isNil(compact) && compact}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[min(60vh,22rem)] w-56 space-y-1 overflow-y-auto"
      >
        {choices.map((choice) => {
          const { rate, listRate } = choiceRate({
            preset,
            resolution: choice.value,
            aspect,
            isAudio,
            hasVideoInput,
            skus: pricing?.skus,
            listSkus: pricing?.listSkus,
            discount,
          })

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
              isRateShown={isRateShown}
              onSelect={setResolution}
            />
          )
        })}
        {showsFallbackFooter(isRateShown, pricing) && (
          <p className="sticky bottom-0 bg-glass px-2 py-1 text-xxs text-fg-2">
            Saved rates, live price unavailable
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
