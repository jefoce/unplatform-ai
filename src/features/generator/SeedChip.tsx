'use client'

import { useCallback } from 'react'
import { isNil } from 'lodash-es'
import { Dices, Lock } from 'lucide-react'

import { SEED_MAX } from '@/core/constants'
import { getPreset } from '@/core/presets'
import { Chip } from '@/ui/Chip'
import { NumberInput } from '@/ui/form/NumberInput'
import { Switch } from '@/ui/form/Switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'
import { Tooltip } from '@/ui/Tooltip'

import { randomSeed, useGeneratorStore } from './store'

/** Random / fixed seed chip with its popover. Hidden when the model has no seed. */
export function SeedChip() {
  const seed = useGeneratorStore((state) => state.seed)
  const setSeed = useGeneratorStore((state) => state.setSeed)
  const preset = getPreset(useGeneratorStore((state) => state.presetId))
  const isRandom = isNil(seed)
  const handleRandomChange = useCallback(
    (isChecked: boolean): void => {
      setSeed(isChecked ? null : randomSeed())
    },
    [setSeed],
  )
  const handleSeedChange = useCallback(
    (value: number | null): void => setSeed(value ?? 0),
    [setSeed],
  )
  const handleRandomize = useCallback((): void => setSeed(randomSeed()), [setSeed])

  if (!preset.seed) return null

  return (
    <Popover>
      <Tooltip content="Provider may not guarantee identical results">
        <PopoverTrigger asChild>
          <Chip>
            {isRandom ? <Dices size={14} aria-hidden /> : <Lock size={14} aria-hidden />}
            {isRandom ? 'Random' : seed}
          </Chip>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="start" className="w-64 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-fg-2">Random seed</span>
          <Switch
            checked={isRandom}
            onCheckedChange={handleRandomChange}
            aria-label="Random seed"
          />
        </div>
        <NumberInput
          id="seed-value"
          name="seed"
          aria-label="Seed value"
          min={0}
          max={SEED_MAX}
          disabled={isRandom}
          value={seed}
          onValueChange={handleSeedChange}
          className="h-8 px-2 text-xs"
        />
        <button
          type="button"
          onClick={handleRandomize}
          className="h-8 w-full rounded-lg bg-subtle text-xs font-medium text-fg hover:bg-hover"
        >
          Randomize
        </button>
      </PopoverContent>
    </Popover>
  )
}
