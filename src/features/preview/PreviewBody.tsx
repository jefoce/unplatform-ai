'use client'

import { AlertTriangle } from 'lucide-react'

import { LazyVideo } from '@/features/player/LazyVideo'
import { mediaUrl, thumbUrl } from '@/lib/api/media-urls'

import type { PreviewItem } from './preview-store'
import { PreviewAudio } from './PreviewAudio'

interface PreviewBodyProps {
  item: PreviewItem | undefined
  playerId: string
}

/** Full-size video, audio or image for the current preview item. */
export function PreviewBody(props: PreviewBodyProps) {
  const { item, playerId } = props

  if (!item || item.missing === true) {
    return (
      <div className="flex flex-col items-center gap-2 text-sm text-danger">
        <AlertTriangle size={24} aria-hidden />
        File missing
      </div>
    )
  }

  const ref = item.previewRef ?? `uploads/${item.id}`
  const mime = item.kind === 'image' ? undefined : item.mime
  const src = mediaUrl(ref, mime)

  if (item.kind === 'video') {
    return (
      <LazyVideo
        id={playerId}
        src={src}
        poster={thumbUrl({ ref, w: 960 })}
        alt={item.originalName}
        className="size-full"
      />
    )
  }

  if (item.kind === 'audio') {
    return <PreviewAudio item={item} src={src} />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- full original, not a thumb
    <img src={src} alt={item.originalName} className="size-full object-contain" />
  )
}
