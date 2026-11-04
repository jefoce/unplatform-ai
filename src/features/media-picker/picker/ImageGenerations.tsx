'use client'

import { useMemo } from 'react'

import { savedImageItems } from '@/lib/feed/picker-items'
import { useImagePages } from '@/lib/use-image-pages'

import { GenerationGrid } from './GenerationGrid'
import type { PickerOutputMode } from './store'

interface ImageGenerationsProps {
  favorite: boolean
  modeKind: 'pick' | 'toggle'
  output?: PickerOutputMode
}

/** Saved image outputs, optionally limited to the liked ones. */
export function ImageGenerations(props: ImageGenerationsProps) {
  const { favorite: isFavorite, modeKind, output } = props

  const { records, isLoading, hasMore, loadMore } = useImagePages({
    filters: { favorite: isFavorite },
  })

  const items = useMemo(() => {
    return savedImageItems(records, isFavorite)
  }, [isFavorite, records])

  const title = isFavorite ? 'Liked' : 'Generations'
  const emptyLabel = isFavorite ? 'No liked images yet' : 'No image generations yet'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center px-4 text-sm font-medium text-fg-2">
        {title}
      </div>

      <GenerationGrid
        items={items}
        isLoading={isLoading}
        modeKind={modeKind}
        output={output}
        emptyLabel={emptyLabel}
        hasMore={hasMore}
        onLoadMore={loadMore}
      />
    </div>
  )
}
