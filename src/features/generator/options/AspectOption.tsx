'use client'

import { isNil } from 'lodash-es'
import { Check } from 'lucide-react'

import { aspectAllowed } from '@/core/output-size'
import type { AspectChoice, ModelPreset, Resolution } from '@/core/presets/types'
import { cn } from '@/lib/cn'
import { PopoverClose } from '@/ui/Popover'
import { RatioIcon } from '@/ui/RatioIcon'
import { Tooltip } from '@/ui/Tooltip'

interface AspectOptionProps {
  option: AspectChoice
  selected: AspectChoice
  preset: ModelPreset
  resolution: Resolution
  onSelect: (option: AspectChoice) => void
}

/** Resolutions that hold the option, empty when it fits everywhere. */
function unavailableFor(option: AspectChoice, preset: ModelPreset): Resolution[] {
  if (option === 'auto') {
    return []
  }

  return preset.resolutions.filter((candidate) => {
    return !isNil(preset.outputSizes?.[candidate]?.[option])
  })
}

function aspectLabel(option: AspectChoice): string {
  if (option === 'auto') {
    return 'Auto'
  }

  return option
}

/** One aspect choice with its price availability and tooltip. */
export function AspectOption(props: AspectOptionProps) {
  const { option, selected, preset, resolution } = props
  const isAllowed = option === 'auto' || aspectAllowed({ preset, resolution, aspect: option })
  const onlyAt = unavailableFor(option, preset)
  const isReason = isAllowed || onlyAt.length === 0

  const reason = isReason ? null : `Only at ${onlyAt.join(', ')}`

  const handleSelect = (): void => {
    props.onSelect(option)
  }

  return (
    <Tooltip content={reason}>
      <span className="inline-flex w-full">
        <PopoverClose asChild>
          <button
            type="button"
            disabled={!isAllowed}
            onClick={handleSelect}
            className={cn(
              'flex min-h-9 w-full items-center gap-2 rounded-lg p-2 text-sm font-medium',
              !isAllowed && 'cursor-not-allowed opacity-40',
              option === selected && 'text-lime',
              !(option === selected) && 'text-fg',
              isAllowed && option !== selected && 'hover:bg-white/5',
            )}
          >
            <RatioIcon ratio={option} />
            {aspectLabel(option)}
            {option === selected && <Check size={14} className="ml-auto" />}
          </button>
        </PopoverClose>
      </span>
    </Tooltip>
  )
}
