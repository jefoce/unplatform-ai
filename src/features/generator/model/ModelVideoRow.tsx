'use client'

import { isNil } from 'lodash-es'
import { Check, Clock, Diamond, Volume2 } from 'lucide-react'

import type { CatalogEntry } from '@/core/catalog'
import type { VideoPreset } from '@/core/presets/video/types'
import { formatRate } from '@/core/pricing/format'
import type { Dict } from '@/core/utility-types'
import { cn } from '@/lib/cn'
import { Price } from '@/ui/Price'

import { isBlockedEntry, type ModelRowProps } from './model-row-props'
import { ModelBadge } from './ModelBadge'
import { PRESET_ICONS } from './preset-icon'
import { videoDuration, videoQuality, videoRate } from './video-picker-model'

interface RowPrice {
  current: number
  list: number | null
  discount: number
}

interface ListRateParams {
  preset: VideoPreset
  skus: Dict<number> | undefined
  discount: number
}

function listRate(params: ListRateParams): number | null {
  const { preset, skus, discount } = params

  if (discount <= 0) {
    return null
  }

  return videoRate(preset, skus)
}

function rowPrice(preset: VideoPreset, entry: CatalogEntry | null): RowPrice | null {
  const pricing = entry?.pricing
  const status = entry?.status
  const current = videoRate(preset, pricing?.skus)

  if (status === 'missing' || isNil(current)) {
    return null
  }

  const discount = pricing?.discount ?? 0

  return {
    current,
    list: listRate({ preset, skus: pricing?.listSkus, discount }),
    discount,
  }
}

interface ModelVideoRowProps extends ModelRowProps {
  preset: VideoPreset
}

/** Video row with capability badges and the live rate. */
export function ModelVideoRow(props: ModelVideoRowProps) {
  const { model, preset, entry, selected: isSelected } = props
  const price = rowPrice(preset, entry)
  const reason = entry?.reason ?? null
  const isBlocked = isBlockedEntry(entry)
  const Icon = PRESET_ICONS[model.icon]

  const handleSelect = (): void => {
    if (isBlocked) {
      return
    }

    props.onSelect(model.id)
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
          <span className="min-w-0 flex-1 truncate text-sm font-medium whitespace-nowrap">
            {model.title}
          </span>
          {!isNil(price) && (
            <span className="ml-auto shrink-0 text-xs whitespace-nowrap text-fg-2">
              from{' '}
              <Price
                current={price.current}
                list={price.list}
                discount={price.discount}
                format={formatRate}
                showDiscountLabel={false}
              />
            </span>
          )}
        </span>
        {isBlocked && !isNil(reason) && (
          <span className="mt-1 block text-xs text-fg-2">{reason}</span>
        )}
        <span className="mt-1 flex flex-wrap gap-1">
          <ModelBadge icon={Diamond} text={videoQuality(preset)} />
          <ModelBadge icon={Clock} text={videoDuration(preset)} />
          {preset.audio.supported && <ModelBadge icon={Volume2} label="Audio" />}
        </span>
      </span>
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        <Check size={14} className={cn('text-accent', !isSelected && 'invisible')} />
      </span>
    </button>
  )
}
