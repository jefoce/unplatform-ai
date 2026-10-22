'use client'

import { isNil } from 'lodash-es'

import type { UploadItem } from '@/core/types'
import { mediaUrl, thumbUrl } from '@/features/media-picker/api'
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
  onOpenPreview?: () => void
  onRemove: () => void
}

interface ThumbStateParams {
  upload?: UploadItem
  isMarkedMissing?: boolean
  hasPreview: boolean
}

interface ThumbState {
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
}

interface ThumbText {
  name: string
  previewLabel: string
  content: string
  overlayClass: string
  tileClass: string
  isPreviewShown: boolean
}

function thumbState(params: ThumbStateParams): ThumbState {
  const { upload, isMarkedMissing, hasPreview } = params
  const isAudio = upload?.kind === 'audio'
  const isVideo = upload?.kind === 'video'
  const isMissing = isMarkedMissing === true || upload?.missing === true
  const isBroken = !upload || isMissing
  const isOpenable = Boolean(upload && !isBroken && !isAudio && hasPreview)

  return { isMissing, isBroken, isAudio, isVideo, isOpenable }
}

function thumbTitle(params: ThumbTitleParams): string {
  const { name, label, isBroken, isMissing } = params

  if (isBroken) return isMissing ? `File missing: ${name}` : 'File deleted'

  if (!isNil(label) && label !== '') return `${label} \u00b7 ${name}`

  return name
}

function thumbOverlay(params: ThumbOverlayParams): string {
  const { isBroken, isLifted } = params

  if (isLifted) return 'hidden'

  return isBroken ? 'flex' : 'hidden group-hover:flex'
}

function thumbMedia(params: ThumbMediaParams): ThumbMedia {
  const { upload, isAudio, isVideo } = params
  let audioSrc = ''

  if (isAudio && !isNil(upload)) audioSrc = mediaUrl(`uploads/${upload.id}`, upload.mime)

  const imageSrc =
    isNil(upload) || isAudio ? null : thumbUrl({ ref: `uploads/${upload.id}`, w: 320 })
  const videoDuration = isVideo && !isNil(upload?.durationSec) ? upload.durationSec : null

  return { audioSrc, imageSrc, videoDuration }
}

function thumbText(params: ThumbTextParams): ThumbText {
  const { upload, label, note, isBroken, isMissing, isAudio, isLifted, isOpenable } = params
  const name = upload?.originalName ?? label ?? 'reference'
  const title = thumbTitle({ name, label, isBroken, isMissing })
  const overlayClass = thumbOverlay({ isBroken, isLifted })
  const tileClass = cn(
    'group relative cursor-grab rounded-xl active:cursor-grabbing',
    isAudio ? 'col-span-2 aspect-[2.12/1]' : 'aspect-square',
    isLifted && 'cursor-grabbing shadow-2xl',
  )

  return {
    name,
    previewLabel: label ?? name,
    content: isNil(note) || note === '' ? title : `${title} \u00b7 ${note}`,
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
    onOpenPreview: handleOpenPreview,
    onRemove: handleRemove,
  } = props
  const { isMissing, isBroken, isAudio, isVideo, isOpenable } = thumbState({
    upload,
    isMarkedMissing,
    hasPreview: !isNil(handleOpenPreview),
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
  })

  return (
    <Tooltip content={content}>
      <div className={tileClass}>
        <ReferenceThumbBody
          imageSrc={imageSrc}
          audioUpload={isAudio ? upload : undefined}
          audioSrc={audioSrc}
          name={name}
          previewLabel={previewLabel}
          videoDuration={videoDuration}
          isAudio={isAudio}
          isBroken={isBroken}
          isMissing={isMissing}
          isOpenable={isOpenable}
          isPreviewShown={isPreviewShown}
          onOpenPreview={handleOpenPreview}
        />

        <ReferenceRemoveButton
          label={previewLabel}
          audioSrc={audioSrc}
          isAudio={isAudio}
          overlayClass={overlayClass}
          onRemove={handleRemove}
        />
      </div>
    </Tooltip>
  )
}
