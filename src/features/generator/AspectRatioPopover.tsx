'use client'

import { useCallback } from 'react'

import type { AspectChoice } from '@/core/presets'
import { getPreset } from '@/core/presets'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'
import { RatioIcon } from '@/ui/RatioIcon'

import { AspectOption } from './AspectOption'
import { useGeneratorStore } from './store'

/** Aspect ratio button and preset list with conditional Auto. */
export function AspectRatioPopover() {
  const aspectRatio = useGeneratorStore((state) => state.aspectRatio)
  const setAspectRatio = useGeneratorStore((state) => state.setAspectRatio)
  const tab = useGeneratorStore((state) => state.tab)
  const start = useGeneratorStore((state) => state.frames.start)
  const resolution = useGeneratorStore((state) => state.resolution)
  const preset = getPreset(useGeneratorStore((state) => state.presetId))

  const isAutoAllowed = tab === 'frames' && Boolean(start) && preset.autoAspectWithFrames
  const options: AspectChoice[] = [...preset.aspectRatios]

  if (isAutoAllowed) options.unshift('auto')

  const handleOpenChange = useCallback(
    (isOpen: boolean): void => {
      if (isOpen && aspectRatio === 'auto' && !isAutoAllowed)
        setAspectRatio(preset.defaultAspectRatio)
    },
    [aspectRatio, isAutoAllowed, preset.defaultAspectRatio, setAspectRatio],
  )
  const handleSelectAspect = useCallback(
    (option: AspectChoice): void => setAspectRatio(option),
    [setAspectRatio],
  )

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 flex-1 items-center gap-1 rounded-md bg-surface px-3 text-sm font-medium text-fg hover:bg-white/6"
        >
          <RatioIcon ratio={aspectRatio} size={16} />
          {aspectRatio === 'auto' ? 'Auto' : aspectRatio}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-40 space-y-1">
        {options.map((option) => (
          <AspectOption
            key={option}
            option={option}
            selected={aspectRatio}
            preset={preset}
            resolution={resolution}
            onSelect={handleSelectAspect}
          />
        ))}
      </PopoverContent>
    </Popover>
  )
}
