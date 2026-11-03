'use client'

import { isNil } from 'lodash-es'
import { Dices, Lock } from 'lucide-react'

import { SEED_MAX } from '@/core/constants'
import { Chip, type ChipSize } from '@/ui/Chip'
import { NumberInput } from '@/ui/form/NumberInput'
import { Switch } from '@/ui/form/Switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'
import { Tooltip } from '@/ui/Tooltip'

import { randomSeed } from '../store/store-helpers'

interface SeedControlProps {
  seed: number | null
  onChange: (seed: number | null) => void
  size?: ChipSize
}

/** Random / fixed seed chip and popover, shared by the video and image bars. */
export function SeedControl(props: SeedControlProps) {
  const { seed, size = 'sm' } = props
  const isRandom = isNil(seed)

  const handleRandomChange = (isChecked: boolean): void => {
    if (isChecked) {
      props.onChange(null)
    } else {
      props.onChange(randomSeed())
    }
  }

  const handleSeedChange = (value: number | null): void => {
    props.onChange(value ?? 0)
  }

  function handleRandomize(): void {
    props.onChange(randomSeed())
  }

  const SeedIcon = isRandom ? Dices : Lock
  const label = isRandom ? 'Random' : seed

  return (
    <Popover>
      <Tooltip content="Provider may not guarantee identical results">
        <PopoverTrigger asChild>
          <Chip size={size}>
            <SeedIcon size={14} aria-hidden />
            {label}
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
