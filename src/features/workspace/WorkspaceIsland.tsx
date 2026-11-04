'use client'

import { Settings } from 'lucide-react'

import { isOneOf } from '@/core/guards'
import { CreditsBadge } from '@/features/generator/credits/CreditsBadge'
import { useProviderReady } from '@/features/generator/use-provider-ready'
import { FilterPopover } from '@/features/history/filters/FilterPopover'
import { useIsFeedScrolled } from '@/features/history/list/feed-scroll'
import type { HistoryView } from '@/features/history/list/view-store'
import { ViewToggle } from '@/features/history/list/ViewToggle'
import { ZoomSlider } from '@/features/history/list/ZoomSlider'
import { openSettings } from '@/features/settings/settings-store'
import {
  setWorkspaceTab,
  useWorkspaceTab,
  WORKSPACE_TAB_OPTIONS,
  WORKSPACE_TABS,
} from '@/features/shared/use-workspace-tab'
import { cn } from '@/lib/cn'
import { SegmentedTabs } from '@/ui/SegmentedTabs'

import { countImageFilters, IMAGE_VIEWS, useImageViewStore } from './image-view-store'
import { ImageFilterForm } from './ImageFilterForm'

const SURFACE_CLASSES =
  'flex h-12 items-center rounded-2xl border border-line-strong bg-glass-island px-2 shadow-toolbar backdrop-blur-island linux:bg-page-2'

const ISLAND_CLASSES =
  'pointer-events-auto flex w-full items-center justify-between gap-2 transition-opacity duration-200 ease-out'

const REST_CLASSES = 'opacity-100'

const SCROLLED_CLASSES =
  'opacity-10 focus-within:opacity-100 hover:opacity-100 has-data-[state=open]:opacity-100 pointer-coarse:opacity-100'

function handleOpenSettings(): void {
  openSettings()
}

function handleTab(value: string): void {
  if (isOneOf(WORKSPACE_TABS, value)) {
    setWorkspaceTab(value)
  }
}

/** Low glass island: workspace tabs, filters, view and account controls. */
export function WorkspaceIsland() {
  const tab = useWorkspaceTab()
  const provider = useProviderReady()
  const isScrolled = useIsFeedScrolled()

  const view = useImageViewStore((state) => {
    return state.view
  })

  const setView = useImageViewStore((state) => {
    return state.setView
  })

  const zoom = useImageViewStore((state) => {
    return state.zoom
  })

  const filters = useImageViewStore((state) => {
    return state.filters
  })

  const setZoom = useImageViewStore((state) => {
    return state.setZoom
  })

  const settingsLabel = provider.isKeyMissing ? 'Settings, API key missing' : 'Settings'
  const opacityClasses = isScrolled ? SCROLLED_CLASSES : REST_CLASSES
  const dataScrolled = isScrolled ? 'true' : 'false'

  const handleViewChange = (next: HistoryView): void => {
    if (isOneOf(IMAGE_VIEWS, next)) {
      setView(next)
    }
  }

  return (
    <header
      data-island="true"
      data-scrolled={dataScrolled}
      className={cn(ISLAND_CLASSES, opacityClasses)}
    >
      <div className={cn(SURFACE_CLASSES, 'w-80 shrink-0 items-center justify-between')}>
        <SegmentedTabs
          options={WORKSPACE_TAB_OPTIONS}
          value={tab}
          onValueChange={handleTab}
          size="sm"
          className="ml-1 w-36"
        />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={settingsLabel}
            onClick={handleOpenSettings}
            className="relative inline-flex size-7 items-center justify-center rounded-lg border border-white/8 bg-white/2 text-fg-2 hover:bg-hover hover:text-fg focus-visible:bg-hover focus-visible:text-fg"
          >
            <Settings size={14} aria-hidden />
            {provider.isKeyMissing && (
              <span
                data-key-missing
                className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-danger"
              />
            )}
          </button>
          <CreditsBadge />
        </div>
      </div>
      <div className={cn(SURFACE_CLASSES, 'gap-2')}>
        <div className="flex h-9 shrink-0 items-center gap-2 rounded-control bg-page-2 px-1">
          <ZoomSlider zoom={zoom} onZoomChange={setZoom} />
          <ViewToggle views={IMAGE_VIEWS} view={view} onViewChange={handleViewChange} />
        </div>
        <FilterPopover activeCount={countImageFilters(filters)}>
          <ImageFilterForm />
        </FilterPopover>
      </div>
    </header>
  )
}
