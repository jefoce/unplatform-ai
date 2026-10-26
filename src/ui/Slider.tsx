'use client'

import { isNil } from 'lodash-es'
import { Slider as SliderPrimitive } from 'radix-ui'

import { cn } from '@/lib/cn'

interface SliderProps {
  value: number
  onValueChange: (value: number) => void
  min: number
  max: number
  step?: number
  className?: string
  ariaLabel?: string
  name?: string
}

/** Single-value ranged slider with neutral track. */
export function Slider(props: SliderProps) {
  const { value, min, max, step = 1, className, ariaLabel, name } = props

  const handleValueChange = ([nextValue]: number[]) => {
    if (isNil(nextValue)) {
      return
    }

    props.onValueChange(nextValue)
  }

  return (
    <SliderPrimitive.Root
      value={[value]}
      onValueChange={handleValueChange}
      min={min}
      max={max}
      step={step}
      name={name}
      className={cn('relative flex h-5 w-full touch-none items-center select-none', className)}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow cursor-pointer overflow-hidden rounded-full bg-white/5">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-white/10" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel}
        className="block size-3 cursor-grab rounded-full bg-white transition outline-none active:cursor-grabbing"
      />
    </SliderPrimitive.Root>
  )
}
