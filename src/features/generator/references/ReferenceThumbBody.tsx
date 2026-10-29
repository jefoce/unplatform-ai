'use client'

import { isNil } from 'lodash-es'
import { Maximize2 } from 'lucide-react'
import type { ReactNode } from 'react'

import type { UploadItem } from '@/core/schemas/upload-item'
import { cn } from '@/lib/cn'
import { formatSecondsExact } from '@/lib/format'
import { RetryImage } from '@/ui/RetryImage'

import { AudioReference } from './AudioReference'
import { ReferenceBrokenOverlay } from './ReferenceBrokenOverlay'

interface ReferenceThumbBodyProps {
  imageSrc: string | null
  audioUpload?: UploadItem
  audioSrc: string
  name: string
  previewLabel: string
  videoDuration: number | null
  isAudio: boolean
  isBroken: boolean
  isMissing: boolean
  isOpenable: boolean
  isPreviewShown: boolean
  onOpenPreview?: () => void
}

/** Inner tile art for a reference: image, audio, badge, broken and preview states. */
export function ReferenceThumbBody(props: ReferenceThumbBodyProps) {
  const {
    imageSrc,
    audioUpload,
    audioSrc,
    name,
    previewLabel,
    videoDuration,
    isAudio,
    isBroken,
    isMissing,
    isOpenable,
    isPreviewShown,
  } = props

  let brokenPlaceholder: ReactNode

  if (!isMissing) {
    brokenPlaceholder = <ReferenceBrokenOverlay isMissing={isMissing} />
  }

  return (
    <div
      className={cn(
        'absolute inset-0 overflow-hidden rounded-xl',
        !isAudio && 'bg-surface-2 ring-1 ring-white/10 ring-inset',
      )}
    >
      {!isNil(imageSrc) && (
        <RetryImage
          src={imageSrc}
          alt={name}
          draggable={false}
          placeholder={brokenPlaceholder}
          className="pointer-events-none absolute inset-0 size-full rounded-[inherit] bg-black/40 object-cover"
        />
      )}

      {!isNil(audioUpload) && <AudioReference upload={audioUpload} src={audioSrc} name={name} />}

      {!isNil(videoDuration) && (
        <span className="pointer-events-none absolute bottom-1 left-1 rounded-sm bg-black/60 px-1 text-xxs font-medium text-fg tabular-nums">
          {formatSecondsExact(videoDuration)}
        </span>
      )}

      {isBroken && <ReferenceBrokenOverlay isMissing={isMissing} />}

      {isOpenable && (
        <button
          type="button"
          onClick={props.onOpenPreview}
          aria-label={`Preview ${previewLabel}`}
          className="absolute inset-0 z-0 size-full cursor-pointer"
        />
      )}

      {isPreviewShown && (
        <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex size-7 items-center justify-center rounded-full bg-black/60 text-fg backdrop-blur-sm">
            <Maximize2 size={12} aria-hidden />
          </span>
        </span>
      )}
    </div>
  )
}
