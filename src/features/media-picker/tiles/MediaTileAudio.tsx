'use client'

import type { UploadItem } from '@/core/schemas/upload-item'

import { AudioTileBody } from './AudioTileBody'

interface MediaTileAudioProps {
  item: UploadItem
  audioSrc: string
  isMissing: boolean
}

/** Audio title, wave and play control for a media tile. */
export function MediaTileAudio(props: MediaTileAudioProps) {
  const { item, audioSrc, isMissing } = props
  const isBadgeOffset = item.source === 'link' || isMissing

  return (
    <AudioTileBody
      name={item.originalName}
      src={audioSrc}
      durationSec={item.durationSec}
      isMissing={isMissing}
      isBadgeOffset={isBadgeOffset}
    />
  )
}
