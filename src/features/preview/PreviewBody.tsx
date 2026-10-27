'use client'

import { type SyntheticEvent, useState } from 'react'
import { isNil, isString } from 'lodash-es'
import { AlertTriangle } from 'lucide-react'

import { LazyVideo } from '@/features/player/LazyVideo'
import type { SeekKeys } from '@/features/player/use-player-input'
import { mediaUrl, thumbUrl } from '@/lib/api/media-urls'
import { cn } from '@/lib/cn'
import { MediaBox } from '@/ui/MediaBox'
import { ZoomLayer } from '@/ui/ZoomLayer'

import type { PreviewItem } from './preview-store'
import { PreviewAudio } from './PreviewAudio'

interface PreviewBodyProps {
  item: PreviewItem | undefined
  playerId: string
  seekKeys?: SeekKeys
  autoPlay?: boolean
}

interface LoadedSize {
  src: string
  aspect: string
}

/** Ratio of the decoded pixels, the truth over stored or EXIF-rotated sizes. */
function naturalAspectOf(image: HTMLImageElement): string | undefined {
  const { naturalWidth, naturalHeight } = image

  if (naturalWidth > 0 && naturalHeight > 0) {
    return `${naturalWidth}/${naturalHeight}`
  }

  return undefined
}

/** Upload size when both sides are positive, else `16/9`. */
function itemAspect(item: PreviewItem): string {
  const { width, height } = item

  if (!isNil(width) && !isNil(height) && width > 0 && height > 0) {
    return `${width}/${height}`
  }

  return '16/9'
}

/** Full-size video, audio or image for the current preview item. */
export function PreviewBody(props: PreviewBodyProps) {
  const { item, playerId, seekKeys, autoPlay: isAutoPlay } = props
  const [loadedSize, setLoadedSize] = useState<LoadedSize>()

  if (!item || item.missing === true) {
    return (
      <MediaBox aspect="16/9">
        <div className="flex size-full flex-col items-center justify-center gap-2 text-sm text-danger">
          <AlertTriangle size={24} aria-hidden />
          File missing
        </div>
      </MediaBox>
    )
  }

  const ref = item.previewRef ?? `uploads/${item.id}`
  const mime = item.kind === 'image' ? undefined : item.mime
  const src = mediaUrl(ref, mime)

  if (item.kind === 'video') {
    return (
      <MediaBox aspect={itemAspect(item)}>
        <LazyVideo
          id={playerId}
          src={src}
          poster={thumbUrl({ ref, w: 960 })}
          alt={item.originalName}
          seekKeys={seekKeys}
          autoPlay={isAutoPlay}
          className="size-full"
        />
      </MediaBox>
    )
  }

  if (item.kind === 'audio') {
    return <PreviewAudio item={item} src={src} />
  }

  const isLoaded = loadedSize?.src === src
  const naturalAspect = isLoaded ? loadedSize.aspect : undefined
  const aspect = naturalAspect ?? itemAspect(item)
  const imageFade = { 'opacity-0': !isLoaded, 'opacity-100': isLoaded }

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const aspect = naturalAspectOf(event.currentTarget)

    if (isString(aspect)) {
      setLoadedSize({ src, aspect })
    }
  }

  return (
    <ZoomLayer resetKey={item.id}>
      <MediaBox aspect={aspect}>
        {/* eslint-disable-next-line @next/next/no-img-element -- full original, not a thumb */}
        <img
          src={src}
          alt={item.originalName}
          draggable={false}
          className={cn(
            'size-full rounded-[inherit] object-contain transition-opacity duration-150',
            imageFade,
          )}
          onLoad={handleImageLoad}
        />
      </MediaBox>
    </ZoomLayer>
  )
}
