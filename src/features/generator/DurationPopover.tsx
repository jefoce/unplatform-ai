'use client'

import { Clock } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'

import { referenceVideoSeconds } from '@/core/duration-limits'
import { getPreset, minDuration } from '@/core/presets'
import { maxDurationFor } from '@/core/validation'
import { formatSecondsExact } from '@/lib/format'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'
import { Slider } from '@/ui/Slider'

import { DurationChip } from './DurationChip'
import { inputFromState, useGeneratorStore } from './store'

/** Duration setting button and slider popover isCapped by reference video length. */
export function DurationPopover() {
  const draft = useGeneratorStore(
    useShallow((state) => ({
      presetId: state.presetId,
      tab: state.tab,
      prompts: state.prompts,
      audio: state.audio,
      duration: state.duration,
      aspectRatio: state.aspectRatio,
      resolution: state.resolution,
      frames: state.frames,
      references: state.references,
      seed: state.seed,
    })),
  )
  const uploadsById = useGeneratorStore((state) => state.uploadsById)
  const handleDurationChange = useGeneratorStore((state) => state.setDuration)
  const preset = getPreset(draft.presetId)
  const { max } = preset.duration
  const min = minDuration(preset)
  const limit = maxDurationFor({
    input: inputFromState(draft),
    uploads: uploadsById,
    preset,
  })
  const chips = (preset.duration.options ?? []).filter((value) => value >= min && value <= max)
  const isFloored = min > preset.duration.min
  const totalVideo = referenceVideoSeconds({
    references: draft.references,
    uploads: uploadsById,
  })
  const isCapped = limit < max
  const limitText = `Up to ${limit}s with ${formatSecondsExact(totalVideo)} of reference video`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 flex-1 items-center gap-1 rounded-md bg-surface px-2 text-sm font-medium text-fg hover:bg-white/6"
        >
          <Clock size={16} />
          {draft.duration}s
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3">
        <div className="flex items-center justify-between text-xs text-fg-2">
          <span>Duration</span>
          <span className="text-fg">{draft.duration}s</span>
        </div>
        <Slider
          value={draft.duration}
          min={min}
          max={limit}
          step={1}
          ariaLabel="Duration"
          name="duration"
          onValueChange={handleDurationChange}
        />
        {isCapped && <p className="text-xs text-fg-2">{limitText}</p>}
        {isFloored && <p className="text-xs text-fg-2">Minimum billed duration is {min}s</p>}
        <div className="flex flex-wrap gap-1.5">
          {chips.map((value) => (
            <DurationChip
              key={value}
              value={value}
              duration={draft.duration}
              limit={limit}
              limitText={limitText}
              onSelect={handleDurationChange}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
