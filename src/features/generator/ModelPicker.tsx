'use client'

import { type ChangeEvent, useCallback, useState } from 'react'
import { isEmpty } from 'lodash-es'
import { ChevronRight } from 'lucide-react'

import { getPreset, MODEL_PRESETS } from '@/core/presets'
import { useMediaQuery } from '@/lib/use-media-query'
import { SearchInput } from '@/ui/form/SearchInput'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'
import { discountLabel } from '@/ui/Price'

import { ModelRow } from './ModelRow'
import { useGeneratorStore } from './store'
import { usePricing } from './use-pricing'

/** Panel-width preset picker with search and capability badges. */
export function ModelPicker() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const presetId = useGeneratorStore((state) => state.presetId)
  const setPreset = useGeneratorStore((state) => state.setPreset)
  const isWide = useMediaQuery('(min-width: 900px)')
  const preset = getPreset(presetId)
  const { pricing } = usePricing()
  const discount = pricing?.discount ?? 0
  const options = MODEL_PRESETS.filter((option) =>
    option.title.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const handleOpenChange = useCallback((isOpen: boolean): void => {
    setIsOpen(isOpen)

    if (!isOpen) setQuery('')
  }, [])
  const handleQueryChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    setQuery(event.target.value)
  }, [])
  const handleSelectPreset = useCallback(
    (id: string): void => {
      setPreset(id)
      setIsOpen(false)
    },
    [setPreset],
  )

  return (
    <div className="mt-4">
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl bg-surface px-4 py-3 text-left hover:bg-white/6"
          >
            <span className="flex flex-col">
              <span className="flex items-center gap-2 text-xs text-fg-2">
                Model
                {discount > 0 && (
                  <span className="text-xxs text-lime">{discountLabel(discount)}</span>
                )}
              </span>
              <span className="text-sm font-medium">{preset.title}</span>
            </span>
            <ChevronRight size={16} className="text-fg-2" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side={isWide ? 'right' : 'bottom'}
          align="start"
          sideOffset={12}
          collisionPadding={16}
          className="flex max-h-[min(70vh,var(--radix-popover-content-available-height))] w-80 flex-col gap-1"
        >
          <SearchInput
            autoFocus
            value={query}
            onChange={handleQueryChange}
            placeholder="Search..."
            aria-label="Search models"
            className="border-0 bg-page-2 pr-2"
          />
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {options.map((option) => (
              <ModelRow
                key={option.id}
                option={option}
                selected={option.id === presetId}
                onSelect={handleSelectPreset}
              />
            ))}
            {isEmpty(options) && <p className="p-3 text-center text-xs text-fg-2">No models</p>}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
