'use client'

import { isNil } from 'lodash-es'
import { AudioLines, Check, Clock, Diamond, type LucideIcon, Sparkles, Volume2 } from 'lucide-react'

import type { CatalogEntry } from '@/core/catalog'
import { minDuration } from '@/core/presets'
import type { ModelPreset, PresetIcon } from '@/core/presets/types'
import { formatRate, pricePerSec } from '@/core/pricing'
import type { Dict } from '@/core/utility-types'
import { useModelEntry } from '@/lib/api/models'
import { cn } from '@/lib/cn'
import { Price } from '@/ui/Price'

import { ModelBadge } from './ModelBadge'

function quality(preset: ModelPreset): string {
  const [first] = preset.resolutions
  const last = preset.resolutions.at(-1)

  if (isNil(first) || isNil(last)) {
    return ''
  }

  if (first === last) {
    return first
  }

  return `${first}-${last}`
}

/** Badge shows the billable range. Quick chips still use `duration.options`. */
function duration(preset: ModelPreset): string {
  return `${minDuration(preset)}-${preset.duration.max}s`
}

const PRESET_ICONS: Record<PresetIcon, LucideIcon> = {
  sparkles: Sparkles,
  'audio-lines': AudioLines,
}

/** Cheapest effective per-second rate across the model's resolutions. */
function fromRate(preset: ModelPreset, skus?: Dict<number>): number | null {
  const ctx = {
    aspect: preset.defaultAspectRatio,
    audio: preset.audio.default,
    hasVideoInput: false,
  }

  const rates = preset.resolutions
    .map((resolution) => {
      return pricePerSec({ preset, ctx: { ...ctx, resolution }, skus })
    })
    .filter((rate): rate is number => {
      return !isNil(rate)
    })

  if (rates.length > 0) {
    return Math.min(...rates)
  }

  return null
}

interface ListRateParams {
  preset: ModelPreset
  skus: Dict<number> | undefined
  discount: number
}

function listRate(params: ListRateParams): number | null {
  const { preset, skus, discount } = params

  if (discount <= 0) {
    return null
  }

  return fromRate(preset, skus)
}

interface RowPrice {
  current: number
  list: number | null
  discount: number
  showDiscountLabel: boolean
}

interface RowData {
  price: RowPrice | null
  reason: string | null
}

function isBlockedEntry(entry: CatalogEntry | null): boolean {
  return entry?.status === 'missing' || entry?.status === 'no_provider'
}

function rowPrice(preset: ModelPreset, entry: CatalogEntry | null): RowPrice | null {
  const pricing = entry?.pricing
  const status = entry?.status
  const current = fromRate(preset, pricing?.skus)

  if (status === 'missing' || isNil(current)) {
    return null
  }

  const discount = pricing?.discount ?? 0

  return {
    current,
    list: listRate({ preset, skus: pricing?.listSkus, discount }),
    discount,
    showDiscountLabel: status === 'no_provider',
  }
}

function rowData(preset: ModelPreset, entry: CatalogEntry | null): RowData {
  const price = rowPrice(preset, entry)

  return { price, reason: entry?.reason ?? null }
}

interface ModelRowProps {
  option: ModelPreset
  selected: boolean
  onSelect: (id: string) => void
}

/** One selectable row in the model picker. */
export function ModelRow(props: ModelRowProps) {
  const { option, selected: isSelected } = props
  const entry = useModelEntry(option.id)
  const { price, reason } = rowData(option, entry)
  const isBlocked = isBlockedEntry(entry)

  const Icon = PRESET_ICONS[option.icon]

  const handleSelect = (): void => {
    if (isBlocked) {
      return
    }

    props.onSelect(option.id)
  }

  return (
    <button
      type="button"
      onClick={handleSelect}
      disabled={isBlocked}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg p-2 text-left',
        !isBlocked && 'hover:bg-white/6',
        isSelected && 'bg-white/6',
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-fg-2">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex w-full items-baseline gap-2">
          <span className="shrink-0 text-sm font-medium">{option.title}</span>
          {!isNil(price) && (
            <span className={cn('ml-auto shrink-0 text-xs whitespace-nowrap text-fg-2')}>
              from{' '}
              <Price
                current={price.current}
                list={price.list}
                discount={price.discount}
                format={formatRate}
                showDiscountLabel={price.showDiscountLabel}
              />
            </span>
          )}
        </span>
        {isBlocked && !isNil(reason) && (
          <span className="mt-1 block text-xs text-fg-2">{reason}</span>
        )}
        <span className="mt-1 flex flex-wrap gap-1">
          <ModelBadge icon={Diamond} text={quality(option)} />
          <ModelBadge icon={Clock} text={duration(option)} />
          {option.audio.supported && <ModelBadge icon={Volume2} label="Audio" />}
        </span>
      </span>
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        <Check size={14} className={cn('text-lime', !isSelected && 'invisible')} />
      </span>
    </button>
  )
}
