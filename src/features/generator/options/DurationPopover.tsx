'use client'

import { Clock } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'

import { getPreset } from '@/core/presets'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'
import { Slider } from '@/ui/Slider'

import { useGeneratorStore } from '../store/store'
import { durationLimit } from './duration-limit'
import { DurationChip } from './DurationChip'

/** Duration setting button and slider popover isCapped by reference video length. */
export function DurationPopover() {
  const draft = useGeneratorStore(
    useShallow((state) => {
      return {
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
      }
    }),
  )

  const uploadsById = useGeneratorStore((state) => {
    return state.uploadsById
  })

  const setDuration = useGeneratorStore((state) => {
    return state.setDuration
  })

  const preset = getPreset(draft.presetId)

  const { min, limit, chips, isFloored, isCapped, limitText } = durationLimit({
    draft,
    uploadsById,
    preset,
  })

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
          onValueChange={setDuration}
        />
        {isCapped && <p className="text-xs text-fg-2">{limitText}</p>}
        {isFloored && <p className="text-xs text-fg-2">Minimum billed duration is {min}s</p>}
        <div className="flex flex-wrap gap-1.5">
          {chips.map((value) => {
            return (
              <DurationChip
                key={value}
                value={value}
                duration={draft.duration}
                limit={limit}
                limitText={limitText}
                onSelect={setDuration}
              />
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
