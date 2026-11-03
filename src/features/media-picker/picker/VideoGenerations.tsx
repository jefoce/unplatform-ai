'use client'

import { useMemo } from 'react'

import { videoItems } from '@/lib/feed/picker-items'
import { useGenerationPages } from '@/lib/use-generation-pages'

import { GenerationGrid } from './GenerationGrid'
import type { PickerOutputMode } from './store'

interface VideoGenerationsProps {
  favorite: boolean
  modeKind: 'pick' | 'toggle'
  output?: PickerOutputMode
}

/** Finished video records, optionally limited to the liked ones. */
export function VideoGenerations(props: VideoGenerationsProps) {
  const { favorite: isFavorite, modeKind, output } = props

  const pages = useGenerationPages({ isFavorite })

  const items = useMemo(() => {
    return videoItems(pages.records, isFavorite)
  }, [isFavorite, pages.records])

  const title = isFavorite ? 'Liked' : 'Video generations'
  const emptyLabel = isFavorite ? 'No liked videos yet' : 'No video generations yet'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center px-4 text-sm font-medium text-fg-2">
        {title}
      </div>

      <GenerationGrid
        items={items}
        isLoading={pages.isLoading}
        modeKind={modeKind}
        output={output}
        emptyLabel={emptyLabel}
        hasMore={pages.hasMore}
        onLoadMore={pages.loadMore}
      />
    </div>
  )
}
