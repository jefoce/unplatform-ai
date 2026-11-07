'use client'

import type { ReactNode } from 'react'

import { GRID_TILE_ASPECT } from '@/core/constants'
import { cancelGeneration } from '@/features/generator/generate/cancel-generation'
import { LazyVideo } from '@/features/player/LazyVideo'
import { cn } from '@/lib/cn'
import type { VideoGridItem } from '@/lib/feed/output-items'

import { MoreMenu } from '../actions/MoreMenu'
import { isCustomActiveRecord } from '../status/status-tone'
import { endpointOfflineView, videoStatusView } from '../status/status-view'
import { StatusOverlay } from '../status/StatusOverlay'
import { useRecordOffline } from '../status/use-record-offline'

interface VideoTileMediaProps {
  item: VideoGridItem
  poster: string
  isCompleted: boolean
  isMasonry: boolean
  radius: string
}

/** Video tile media: hover loop or the status overlay. */
export function VideoTileMedia(props: VideoTileMediaProps) {
  const { item, isCompleted, isMasonry, radius } = props
  const poster = props.poster === '' ? undefined : props.poster
  const isOffline = useRecordOffline(item.source)

  const handleCancel = () => {
    void cancelGeneration(item.source.id)
  }

  if (!isCompleted) {
    const base = videoStatusView(item.source, handleCancel)
    let view = base

    if (isOffline) {
      view = endpointOfflineView(base)
    }

    let menu: ReactNode = null

    if (isCustomActiveRecord(item.source)) {
      menu = <MoreMenu item={item} />
    }

    return (
      <div className="size-full">
        <StatusOverlay
          view={view}
          boxAspect={GRID_TILE_ASPECT}
          fill={isMasonry}
          className={radius}
          menu={menu}
        />
      </div>
    )
  }

  return (
    <LazyVideo
      id={item.id}
      src={item.mediaSrc}
      poster={poster}
      posterFit="cover"
      videoFit="cover"
      hoverPlay
      className={cn('size-full', radius)}
    />
  )
}
