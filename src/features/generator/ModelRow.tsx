'use client'

import { useCallback } from 'react'
import { isNil } from 'lodash-es'
import { AudioLines, Check, Clock, Diamond, type LucideIcon, Sparkles, Volume2 } from 'lucide-react'

import { minDuration, type ModelPreset } from '@/core/presets'
import { formatRate, pricePerSec } from '@/core/pricing'
import { cn } from '@/lib/cn'
import { Price } from '@/ui/Price'

import { ModelBadge } from './ModelBadge'
import { usePricing } from './use-pricing'

function quality(preset: ModelPreset): string {
  const first = preset.resolutions[0]
  const last = preset.resolutions.at(-1)

  return first === last ? first : `${first}-${last}`
}

/** Badge shows the billable range. Quick chips still use `duration.options`. */
function duration(preset: ModelPreset): string {
  return `${minDuration(preset)}-${preset.duration.max}s`
}

const PRESET_ICONS: Record<ModelPreset['icon'], LucideIcon> = {
  sparkles: Sparkles,
  'audio-lines': AudioLines,
}

/** Cheapest effective per-second rate across the model's resolutions. */
function fromRate(preset: ModelPreset, skus?: Record<string, number>): number | null {
  const ctx = {
    aspect: preset.defaultAspectRatio,
    audio: preset.audio.default,
    hasVideoInput: false,
  }
  const rates = preset.resolutions
    .map((resolution) => pricePerSec({ preset, ctx: { ...ctx, resolution }, skus }))
    .filter((rate): rate is number => !isNil(rate))

  return rates.length > 0 ? Math.min(...rates) : null
}

interface ModelRowProps {
  option: ModelPreset
  selected: boolean
  onSelect: (id: string) => void
}

/** One selectable row in the model picker. */
export function ModelRow(props: ModelRowProps) {
  const { option, selected: isSelected, onSelect } = props
  const { pricing } = usePricing(option.id)
  const discount = pricing?.discount ?? 0
  const from = fromRate(option, pricing?.skus)
  let listFrom: number | null = null

  if (discount > 0) listFrom = fromRate(option, pricing?.listSkus)

  const Icon = PRESET_ICONS[option.icon]
  const handleSelect = useCallback((): void => onSelect(option.id), [onSelect, option.id])

  return (
    <button
      type="button"
      onClick={handleSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-white/6',
        isSelected && 'bg-white/6',
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-fg-2">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex w-full items-baseline gap-2">
          <span className="shrink-0 text-sm font-medium">{option.title}</span>
          {!isNil(from) && (
            <span className={cn('ml-auto shrink-0 text-xs whitespace-nowrap text-fg-2')}>
              from <Price current={from} list={listFrom} discount={discount} format={formatRate} />
            </span>
          )}
        </span>
        <span className="mt-1 flex flex-wrap gap-1">
          <ModelBadge icon={Diamond} text={quality(option)} />
          <ModelBadge icon={Clock} text={duration(option)} />
          {option.audio.supported && <ModelBadge icon={Volume2} label="Audio" />}
        </span>
      </span>
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        <Check size={14} className={cn('text-lime', isSelected ? undefined : 'invisible')} />
      </span>
    </button>
  )
}
