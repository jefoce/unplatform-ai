'use client'

import { type ChangeEvent, useMemo, useState } from 'react'
import { isEmpty } from 'lodash-es'

import type { PickerModel } from '@/core/feed/picker-model'
import { VIDEO_PRESETS } from '@/core/presets'
import { useModelEntry } from '@/lib/api/models'
import { cn } from '@/lib/cn'
import { useBoolean } from '@/lib/use-boolean'
import { useMediaQuery } from '@/lib/use-media-query'
import { SearchInput } from '@/ui/form/SearchInput'
import { Popover, PopoverContent } from '@/ui/Popover'

import { useGeneratorStore } from '../store/store'
import { ModelPickerTrigger, type ModelPickerVariant } from './ModelPickerTrigger'
import { ModelRow } from './ModelRow'
import { videoPickerModel } from './video-picker-model'

const VIDEO_MODELS = VIDEO_PRESETS.map((preset) => {
  return videoPickerModel(preset, null)
})

function currentModel(models: readonly PickerModel[], selectedId: string): PickerModel {
  const found = models.find((model) => {
    return model.id === selectedId
  })

  if (found) {
    return found
  }

  return {
    id: selectedId,
    title: selectedId,
    icon: 'sparkles',
    description: '',
    priceText: '',
  }
}

function searchModels(models: readonly PickerModel[], query: string): PickerModel[] {
  const needle = query.trim().toLowerCase()

  return models.filter((model) => {
    return model.title.toLowerCase().includes(needle)
  })
}

interface ModelPickerProps {
  models?: readonly PickerModel[]
  selectedId?: string
  onSelect?: (id: string) => void
  variant?: ModelPickerVariant
}

interface PopoverSideParams {
  isBar: boolean
  isWide: boolean
}

function popoverSide(params: PopoverSideParams): 'top' | 'right' | 'bottom' {
  if (params.isBar) {
    return 'top'
  }

  if (params.isWide) {
    return 'right'
  }

  return 'bottom'
}

/** Preset picker with search and capability badges, panel or compact bar. */
export function ModelPicker(props: ModelPickerProps) {
  const modelMenu = useBoolean()
  const [query, setQuery] = useState('')

  const presetId = useGeneratorStore((state) => {
    return state.presetId
  })

  const setPreset = useGeneratorStore((state) => {
    return state.setPreset
  })

  const isWide = useMediaQuery('(min-width: 900px)')

  const models = props.models ?? VIDEO_MODELS
  const selectedId = props.selectedId ?? presetId
  const entry = useModelEntry(selectedId)
  const discount = entry?.pricing?.discount ?? 0

  const { options, current } = useMemo(() => {
    return { options: searchModels(models, query), current: currentModel(models, selectedId) }
  }, [models, query, selectedId])

  const handleOpenChange = (isOpen: boolean): void => {
    modelMenu.set(isOpen)

    if (!isOpen) {
      setQuery('')
    }
  }

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setQuery(event.target.value)
  }

  const handleSelectPreset = (id: string): void => {
    if (props.onSelect) {
      props.onSelect(id)
    } else {
      setPreset(id)
    }

    modelMenu.off()
  }

  const isBar = props.variant === 'bar'
  const side = popoverSide({ isBar, isWide })
  const contentWidth = isBar ? 'w-96' : 'w-80'

  const picker = (
    <Popover open={modelMenu.value} onOpenChange={handleOpenChange}>
      <ModelPickerTrigger model={current} discount={discount} variant={props.variant} />
      <PopoverContent
        side={side}
        align="start"
        sideOffset={12}
        collisionPadding={16}
        className={cn(
          'flex max-h-[min(70vh,var(--radix-popover-content-available-height))] flex-col gap-1',
          contentWidth,
        )}
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
          {options.map((option) => {
            return (
              <ModelRow
                key={option.id}
                model={option}
                selected={option.id === selectedId}
                onSelect={handleSelectPreset}
              />
            )
          })}
          {isEmpty(options) && <p className="p-3 text-center text-xs text-fg-2">No models</p>}
        </div>
      </PopoverContent>
    </Popover>
  )

  if (isBar) {
    return picker
  }

  return <div className="mt-4">{picker}</div>
}
