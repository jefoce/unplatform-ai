'use client'

import { type ChangeEvent, useState } from 'react'

import type { CatalogEntry } from '@/core/catalog'
import { cn } from '@/lib/cn'
import { Input } from '@/ui/form/Input'
import { PopoverContent } from '@/ui/Popover'

import { ModelGroupList } from './ModelGroupList'
import { ModelRefreshButton } from './ModelRefreshButton'
import type { PickerGroup } from './picker-groups'
import { contentWidth, popoverSide, searchGroups, visibleGroups } from './picker-view'

interface ModelPickerContentProps {
  groups: readonly PickerGroup[]
  entries: ReadonlyMap<string, CatalogEntry>
  selectedId: string
  isBar: boolean
  isWide: boolean
  isFetching: boolean
  onRefresh: () => void
  onSelect: (id: string) => void
}

/** Searchable popover body with the model groups and a refresh control. */
export function ModelPickerContent(props: ModelPickerContentProps) {
  const { isBar, isWide } = props
  const [query, setQuery] = useState('')
  const visible = visibleGroups(searchGroups(props.groups, query))

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setQuery(event.target.value)
  }

  return (
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
        <ModelRefreshButton isFetching={props.isFetching} onRefresh={props.onRefresh} />
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        <ModelGroupList
          groups={visible}
          entries={props.entries}
          selectedId={props.selectedId}
          onSelect={props.onSelect}
        />
      </div>
    </PopoverContent>
  )
}
