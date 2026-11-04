'use client'

import { isNil } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import type { UploadItem } from '@/core/schemas/upload-item'
import { mediaUrl, thumbUrl } from '@/lib/api/media-urls'
import { cn } from '@/lib/cn'
import { Tooltip } from '@/ui/Tooltip'

import { ReferenceRemoveButton } from './ReferenceRemoveButton'
import { ReferenceThumbBody } from './ReferenceThumbBody'

interface ReferenceThumbProps {
  upload?: UploadItem
  label?: string
  missing?: boolean
  lifted?: boolean
  note?: string
  compact?: boolean
  isUploadsLoading?: boolean
  onOpenPreview?: () => void
  onRemove: () => void
}

interface ThumbStateParams {
  upload?: UploadItem
  isMarkedMissing?: boolean
  isUploadsLoading?: boolean
  hasPreview: boolean
}

interface ThumbState {
  isPending: boolean
  isMissing: boolean
  isBroken: boolean
  isAudio: boolean
  isVideo: boolean
  isOpenable: boolean
}

interface ThumbTitleParams {
  name: string
  label?: string
  isBroken: boolean
  isMissing: boolean
}

interface ThumbOverlayParams {
  isBroken: boolean
  isLifted: boolean
}

interface ThumbMediaParams {
  upload?: UploadItem
  isAudio: boolean
  isVideo: boolean
}

interface ThumbMedia {
  audioSrc: string
  imageSrc: string | null
  videoDuration: number | null
}

interface ThumbTextParams {
  upload?: UploadItem
  label?: string
  note?: string
  isBroken: boolean
  isMissing: boolean
  isAudio: boolean
  isLifted: boolean
  isOpenable: boolean
  isCompact: boolean
}

interface ThumbText {
  name: string
  previewLabel: string
  content: string
  overlayClass: string
  tileClass: string
  isPreviewShown: boolean
}

interface ThumbTileParams {
  isAudio: boolean
  isLifted: boolean
  isCompact: boolean
}

function thumbTileClass(params: ThumbTileParams): string {
  const { isAudio, isLifted, isCompact } = params

  if (isCompact) {
    return cn(
      'group relative size-16 cursor-grab rounded-md active:cursor-grabbing',
      isLifted && 'cursor-grabbing shadow-2xl',
    )
  }

  return cn(
    'group relative cursor-grab rounded-xl active:cursor-grabbing',
    isAudio && 'col-span-2 aspect-[2.12/1]',
    !isAudio && 'aspect-square',
    isLifted && 'cursor-grabbing shadow-2xl',
  )
}

function thumbState(params: ThumbStateParams): ThumbState {
  const { upload, isMarkedMissing, isUploadsLoading, hasPreview } = params
  const isAudio = upload?.kind === 'audio'
  const isVideo = upload?.kind === 'video'
  const isPending = isUploadsLoading === true && isNil(upload)
  const isMissing = isMarkedMissing === true || upload?.missing === true
  const isBroken = !upload || isMissing
  const isOpenable = Boolean(upload && !isBroken && !isAudio && hasPreview)

  return { isPending, isMissing, isBroken, isAudio, isVideo, isOpenable }
}

function thumbTitle(params: ThumbTitleParams): string {
  const { name, label, isBroken, isMissing } = params

  if (isBroken) {
    if (isMissing) {
      return `File missing: ${name}`
    }

    return 'File deleted'
  }

  if (isNonEmptyString(label)) {
    return `${label} \u00b7 ${name}`
  }

  return name
}

function thumbOverlay(params: ThumbOverlayParams): string {
  const { isBroken, isLifted } = params

  if (isLifted) {
    return 'hidden'
  }

  if (isBroken) {
    return 'flex'
  }

  return 'hidden group-hover:flex'
}

function thumbMedia(params: ThumbMediaParams): ThumbMedia {
  const { upload, isAudio, isVideo } = params
  let audioSrc = ''

  if (isAudio && !isNil(upload)) {
    audioSrc = mediaUrl(`uploads/${upload.id}`, upload.mime)
  }

  const isImageSrc = isNil(upload) || isAudio
  let imageSrc: string | null = null

  if (!isImageSrc && !isNil(upload)) {
    imageSrc = thumbUrl({ ref: `uploads/${upload.id}`, w: 320 })
  }

  let videoDuration: number | null = null

  if (isVideo) {
    videoDuration = upload?.durationSec ?? null
  }

  return { audioSrc, imageSrc, videoDuration }
}

function thumbContent(title: string, note?: string): string {
  if (!isNonEmptyString(note)) {
    return title
  }

  return `${title} \u00b7 ${note}`
}

function thumbText(params: ThumbTextParams): ThumbText {
  const { upload, label, note, isBroken, isMissing, isAudio, isLifted, isOpenable, isCompact } =
    params

  const name = upload?.originalName ?? label ?? 'reference'
  const title = thumbTitle({ name, label, isBroken, isMissing })
  const overlayClass = thumbOverlay({ isBroken, isLifted })
  const content = thumbContent(title, note)
  const tileClass = thumbTileClass({ isAudio, isLifted, isCompact })

  return {
    name,
    previewLabel: label ?? name,
    content,
    overlayClass,
    tileClass,
    isPreviewShown: isOpenable && !isLifted,
  }
}

/** One reference tile with preview and remove. Sorting lives in the wrapper. */
export function ReferenceThumb(props: ReferenceThumbProps) {
  const {
    upload,
    label,
    missing: isMarkedMissing,
    lifted: isLifted = false,
    note,
    compact: isCompact = false,
    isUploadsLoading,
  } = props

  const { isPending, isMissing, isBroken, isAudio, isVideo, isOpenable } = thumbState({
    upload,
    isMarkedMissing,
    isUploadsLoading,
    hasPreview: !isNil(props.onOpenPreview),
  })

  const { audioSrc, imageSrc, videoDuration } = thumbMedia({ upload, isAudio, isVideo })

  const { name, previewLabel, content, overlayClass, tileClass, isPreviewShown } = thumbText({
    upload,
    label,
    note,
    isBroken,
    isMissing,
    isAudio,
    isLifted,
    isOpenable,
    isCompact,
  })

  const audioUpload = isAudio ? upload : undefined

  if (isPending) {
    return (
      <div className={tileClass}>
        <span
          data-reference-skeleton
          aria-hidden
          className="absolute inset-0 block animate-pulse rounded-[inherit] bg-surface-2"
        />
      </div>
    )
  }

  return (
    <Tooltip content={content}>
      <div className={tileClass}>
        <ReferenceThumbBody
          imageSrc={imageSrc}
          audioUpload={audioUpload}
          audioSrc={audioSrc}
          name={name}
          previewLabel={previewLabel}
          videoDuration={videoDuration}
          isAudio={isAudio}
          isBroken={isBroken}
          isMissing={isMissing}
          isOpenable={isOpenable}
          isPreviewShown={isPreviewShown}
          onOpenPreview={props.onOpenPreview}
        />

        <ReferenceRemoveButton
          label={previewLabel}
          audioSrc={audioSrc}
          isAudio={isAudio}
          overlayClass={overlayClass}
          onRemove={props.onRemove}
        />
      </div>
    </Tooltip>
  )
}
