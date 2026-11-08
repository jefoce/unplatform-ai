'use client'

import { isNil } from 'lodash-es'
import type { ReactNode } from 'react'

import { videoRecordAspect } from '@/core/media/aspect'
import { LazyVideo } from '@/features/player/LazyVideo'
import {
  type HistoryItem,
  itemAspect,
  posterSrc,
  type VideoGridItem,
} from '@/lib/feed/output-items'
import { MediaBox } from '@/ui/MediaBox'
import { MediaImage } from '@/ui/MediaImage'
import { MediaStage, type StageBackdrop } from '@/ui/MediaStage'
import { ZoomLayer } from '@/ui/ZoomLayer'

import { HistoryModalStatus } from './HistoryModalStatus'
import type { HistoryNav } from './use-history-nav'

interface HistoryModalMediaProps {
  item: HistoryItem
  nav: HistoryNav
  toolbar: ReactNode
  backdrop: StageBackdrop
  onCancel: () => void
}

/** Record ratio as width / height, 16 / 9 when the stored value is malformed. */
function videoAspectOf(item: VideoGridItem): number {
  const [width, height] = videoRecordAspect(item.source).split('/').map(Number)

  const isValid =
    !isNil(width) &&
    !isNil(height) &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    height > 0

  if (!isValid) {
    return 16 / 9
  }

  return width / height
}

const aspectOf = (item: HistoryItem): number => {
  if (item.recordKind === 'video') {
    return videoAspectOf(item)
  }

  return itemAspect(item)
}

/** Viewer stage: video player, saved image, or the running/failed overlay. */
export function HistoryModalMedia(props: HistoryModalMediaProps) {
  const { item, backdrop } = props

  let poster = item.thumbSrc

  if (item.recordKind === 'video') {
    poster = posterSrc(item.source, 1280) ?? ''
  }

  const videoPoster = poster === '' ? undefined : poster

  return (
    <MediaStage backdrop={backdrop} nav={props.nav} toolbar={props.toolbar}>
      {item.status === 'completed' && item.recordKind === 'video' && (
        <MediaBox aspect={aspectOf(item)}>
          <LazyVideo
            key={item.id}
            id={`modal-${item.id}`}
            src={item.mediaSrc}
            poster={videoPoster}
            posterFit="contain"
            videoFit="contain"
            seekKeys="shiftArrows"
            autoPlay
            className="size-full"
          />
        </MediaBox>
      )}
      {item.status === 'completed' && item.recordKind === 'image' && (
        <ZoomLayer resetKey={item.id}>
          <MediaBox aspect={aspectOf(item)}>
            <MediaImage src={item.mediaSrc} alt={item.prompt} fit="cover" />
          </MediaBox>
        </ZoomLayer>
      )}
      {item.status !== 'completed' && item.recordKind === 'video' && (
        <div className="@container w-full max-w-2xl">
          <HistoryModalStatus item={item} onCancel={props.onCancel} />
        </div>
      )}
    </MediaStage>
  )
}
