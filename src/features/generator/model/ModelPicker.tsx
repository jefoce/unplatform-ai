'use client'

import { type ChangeEvent, useMemo, useState } from 'react'
import { isNil } from 'lodash-es'

import type { CatalogEntry } from '@/core/catalog'
import type { PickerModel } from '@/core/feed/picker-model'
import { VIDEO_PRESETS } from '@/core/presets'
import { refreshCatalog, useCatalog, useModelEntry } from '@/lib/api/catalog'
import { cn } from '@/lib/cn'
import { useBoolean } from '@/lib/use-boolean'
import { useMediaQuery } from '@/lib/use-media-query'
import { Input } from '@/ui/form/Input'
import { Popover, PopoverContent } from '@/ui/Popover'

import { useGeneratorStore } from '../store/store'
import { ModelGroupList } from './ModelGroupList'
import { ModelPickerTrigger, type ModelPickerVariant } from './ModelPickerTrigger'
import { ModelRefreshButton } from './ModelRefreshButton'
import {
  type PickerGroup,
  pickerGroups,
  type PickerKind,
  type PickerRow,
  selectedTitle,
} from './picker-groups'
import { presetTitleOf } from './preset-title'
import { videoPickerModel } from './video-picker-model'

const VIDEO_MODELS = VIDEO_PRESETS.map((preset) => {
  return videoPickerModel(preset, null)
})

interface FallbackRowParams {
  selectedId: string
  entry: CatalogEntry | null
}

// eslint-disable-next-line complexity -- one row mirrors the catalog entry shape
function fallbackRow(params: FallbackRowParams): PickerRow {
  const { selectedId, entry } = params
  const source = entry?.source

  const preset = entry?.preset

  return {
    id: selectedId,
    title: preset?.title ?? presetTitleOf(selectedId) ?? selectedTitle(selectedId),
    icon: 'sparkles',
    description: '',
    priceText: '',
    kind: source?.kind,
    badge: source?.badge,
    workflowName: source?.workflowName,
    status: entry?.status,
    reason: entry?.reason,
    availability: entry?.availability,
    isCustom: source?.kind === 'custom',
  }
}

function currentRow(groups: readonly PickerGroup[], selectedId: string): PickerRow | null {
  for (const group of groups) {
    const found = group.rows.find((row) => {
      return row.id === selectedId
    })

    if (found) {
      return found
    }
  }

  return null
}

function searchGroups(groups: readonly PickerGroup[], query: string): PickerGroup[] {
  const needle = query.trim().toLowerCase()

  if (needle === '') {
    return [...groups]
  }

  return groups.map((group) => {
    const rows = group.rows.filter((row) => {
      const haystack = `${row.title} ${row.workflowName ?? ''}`.toLowerCase()

      return haystack.includes(needle)
    })

    return { ...group, rows }
  })
}

function visibleGroups(groups: readonly PickerGroup[]): PickerGroup[] {
  return groups.filter((group) => {
    return group.rows.length > 0
  })
}

interface ModelPickerProps {
  models?: readonly PickerModel[]
  selectedId?: string
  onSelect?: (id: string) => void
  variant?: ModelPickerVariant
  kind?: PickerKind
}

interface PopoverSideParams {
  isBar: boolean
  isWide: boolean
}

function popoverSide(params: PopoverSideParams): 'top' | 'right' | 'bottom' {
  const { isBar, isWide } = params

  if (isBar) {
    return 'top'
  }

  if (isWide) {
    return 'right'
  }

  return 'bottom'
}

function contentWidth(isBar: boolean): string {
  if (isBar) {
    return 'w-96'
  }

  return 'w-80'
}

/** Preset picker with search, provider groups, prices and a refresh control. */
// eslint-disable-next-line max-lines-per-function -- one picker owns its trigger, search and groups
export function ModelPicker(props: ModelPickerProps) {
  const modelMenu = useBoolean()
  const [query, setQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const presetId = useGeneratorStore((state) => {
    return state.presetId
  })

  const setPreset = useGeneratorStore((state) => {
    return state.setPreset
  })

  const isWide = useMediaQuery('(min-width: 900px)')
  const { catalog, isValidating } = useCatalog()
  const entry = useModelEntry(props.selectedId ?? presetId)

  const selectedId = props.selectedId ?? presetId
  const isBar = props.variant === 'bar'

  const groups = useMemo(() => {
    return pickerGroups({
      models: props.models ?? VIDEO_MODELS,
      entries: catalog?.entries ?? [],
      kind: props.kind ?? 'video',
    })
  }, [props.models, props.kind, catalog])

  const visible = visibleGroups(searchGroups(groups, query))
  const current = currentRow(groups, selectedId) ?? fallbackRow({ selectedId, entry })
  const isFetching = isRefreshing || isValidating

  const handleRefresh = (): void => {
    setIsRefreshing(true)

    void refreshCatalog().finally(() => {
      setIsRefreshing(false)
    })
  }

  const handleOpenChange = (isOpen: boolean): void => {
    modelMenu.set(isOpen)

    if (!isOpen) {
      setQuery('')

      return
    }

    handleRefresh()
  }

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setQuery(event.target.value)
  }

  const handleSelectPreset = (id: string): void => {
    if (isNil(props.onSelect)) {
      setPreset(id)
    } else {
      props.onSelect(id)
    }

    modelMenu.off()
  }

  const picker = (
    <Popover open={modelMenu.value} onOpenChange={handleOpenChange}>
      <ModelPickerTrigger
        model={current}
        discount={entry?.pricing?.discount ?? 0}
        variant={props.variant}
      />
      <PopoverContent
        side={popoverSide({ isBar, isWide })}
        align="start"
        sideOffset={12}
        collisionPadding={16}
        className={cn(
          'flex max-h-[min(70vh,var(--radix-popover-content-available-height))] flex-col gap-1',
          contentWidth(isBar),
        )}
      >
        <div className="relative shrink-0">
          <Input
            autoFocus
            value={query}
            onChange={handleQueryChange}
            placeholder="Search..."
            aria-label="Search models"
            className="border-0 bg-page-2 pr-9"
          />
          <ModelRefreshButton isFetching={isFetching} onRefresh={handleRefresh} />
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          <ModelGroupList groups={visible} selectedId={selectedId} onSelect={handleSelectPreset} />
        </div>
      </PopoverContent>
    </Popover>
  )

  if (isBar) {
    return picker
  }

  return <div className="mt-4">{picker}</div>
}
