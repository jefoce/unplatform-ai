'use client'

import { useMemo } from 'react'

import { savedImageItems, videoItems } from '@/lib/feed/picker-items'
import { useGenerationPages } from '@/lib/use-generation-pages'
import { useImagePages } from '@/lib/use-image-pages'

import { GenerationGrid } from './GenerationGrid'
import type { PickerOutputMode } from './store'

interface LikedGenerationsProps {
  modeKind: 'pick' | 'toggle'
  output?: PickerOutputMode
}

/** Liked image outputs and video records in one grid for the both-kinds picker. */
export function LikedGenerations(props: LikedGenerationsProps) {
  const { modeKind, output } = props

  const images = useImagePages({ filters: { favorite: true } })
  const videos = useGenerationPages({ isFavorite: true })

  const items = useMemo(() => {
    return [...savedImageItems(images.records, true), ...videoItems(videos.records, true)]
  }, [images.records, videos.records])

  const handleLoadMore = () => {
    images.loadMore()
    videos.loadMore()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center px-4 text-sm font-medium text-fg-2">
        Liked
      </div>

      <GenerationGrid
        items={items}
        isLoading={images.isLoading || videos.isLoading}
        modeKind={modeKind}
        output={output}
        emptyLabel="No liked generations yet"
        hasMore={images.hasMore || videos.hasMore}
        onLoadMore={handleLoadMore}
      />
    </div>
  )
}
