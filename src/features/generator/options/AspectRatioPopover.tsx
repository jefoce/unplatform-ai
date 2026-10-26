'use client'

import { getPreset } from '@/core/presets'
import type { AspectChoice } from '@/core/presets/types'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'
import { RatioIcon } from '@/ui/RatioIcon'

import { useGeneratorStore } from '../store/store'
import { AspectOption } from './AspectOption'

/** Aspect ratio button and preset list with conditional Auto. */
export function AspectRatioPopover() {
  const aspectRatio = useGeneratorStore((state) => {
    return state.aspectRatio
  })

  const setAspectRatio = useGeneratorStore((state) => {
    return state.setAspectRatio
  })

  const tab = useGeneratorStore((state) => {
    return state.tab
  })

  const start = useGeneratorStore((state) => {
    return state.frames.start
  })

  const resolution = useGeneratorStore((state) => {
    return state.resolution
  })

  const preset = getPreset(
    useGeneratorStore((state) => {
      return state.presetId
    }),
  )

  const isAutoAllowed = tab === 'frames' && Boolean(start) && preset.autoAspectWithFrames
  const options: AspectChoice[] = [...preset.aspectRatios]

  if (isAutoAllowed) {
    options.unshift('auto')
  }

  const handleOpenChange = (isOpen: boolean): void => {
    if (isOpen && aspectRatio === 'auto' && !isAutoAllowed) {
      setAspectRatio(preset.defaultAspectRatio)
    }
  }

  const handleSelectAspect = (option: AspectChoice): void => {
    setAspectRatio(option)
  }

  const label = aspectRatio === 'auto' ? 'Auto' : aspectRatio

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 flex-1 items-center gap-1 rounded-md bg-surface px-3 text-sm font-medium text-fg hover:bg-white/6"
        >
          <RatioIcon ratio={aspectRatio} size={16} />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-40 space-y-1">
        {options.map((option) => {
          return (
            <AspectOption
              key={option}
              option={option}
              selected={aspectRatio}
              preset={preset}
              resolution={resolution}
              onSelect={handleSelectAspect}
            />
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
