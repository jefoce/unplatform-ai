'use client'

import { Film, Image as ImageIcon, Maximize2, Play } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'

import type { FolderFile } from '@/core/media-types'
import { cn } from '@/lib/cn'
import { RetryImage } from '@/ui/RetryImage'
import { Spinner } from '@/ui/Spinner'
import { Tooltip } from '@/ui/Tooltip'

import { MediaTileBadges } from '../tiles/MediaTileBadges'
import { SELECTED_TILE_CLASSES } from '../tiles/tile-classes'

interface FolderFileTileProps {
  file: FolderFile
  src: string
  isBroken: boolean
  isSelected: boolean
  slotNumber?: number
  isDisabled: boolean
  isBusy: boolean
  disabledReason?: string
  onSelect: (rel: string) => void
  onExpand: (file: FolderFile) => void
  onBroken: (src: string) => void
}

interface FolderFileBodyParams {
  file: FolderFile
  src: string
  isBroken: boolean
}

/** Thumbnail, audio label or broken icon for a folder file. */
function folderFileBody(params: FolderFileBodyParams): ReactNode {
  const { file, src, isBroken } = params

  if (file.kind === 'audio') {
    return (
      <span className="flex size-full flex-col justify-between bg-white/5 p-2">
        <span className="truncate text-sm font-medium">{file.name}</span>
        <span className="text-xs text-fg-2 capitalize">{file.kind}</span>
      </span>
    )
  }

  const BrokenIcon = file.kind === 'video' ? Film : ImageIcon

  if (isBroken) {
    return (
      <span className="flex size-full items-center justify-center bg-white/5 text-fg-2">
        <BrokenIcon size={24} aria-hidden />
      </span>
    )
  }

  return (
    <>
      <RetryImage
        src={src}
        loading="lazy"
        alt=""
        kind={file.kind}
        placeholder={
          <span className="flex size-full items-center justify-center bg-white/5 text-fg-2">
            <BrokenIcon size={24} aria-hidden />
          </span>
        }
        className="pointer-events-none absolute inset-0 size-full rounded-[inherit] bg-black/40 object-cover"
      />
      {file.kind === 'video' && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
          <Play className="size-7 fill-current" aria-hidden />
        </span>
      )}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/50 px-2 py-1 text-xs">
        {file.name}
      </span>
    </>
  )
}

/** File tile in the read-only folder grid. */
export function FolderFileTile(props: FolderFileTileProps) {
  const { file, src, isBroken, isSelected, slotNumber, isDisabled, isBusy, disabledReason } = props
  const isBlocked = isDisabled || isBusy

  const handleSelect = () => {
    props.onSelect(file.rel)
  }

  const handleExpandClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    props.onExpand(file)
  }

  return (
    <Tooltip content={disabledReason}>
      <div
        title={file.name}
        className={cn(
          'group relative aspect-square overflow-hidden rounded-lg border border-line bg-surface text-left transition-opacity hover:opacity-90',
          isSelected && SELECTED_TILE_CLASSES,
          isDisabled && 'opacity-40',
        )}
      >
        <button
          type="button"
          onClick={handleSelect}
          disabled={isBlocked}
          aria-pressed={isSelected}
          aria-label={`Select ${file.name}`}
          className={cn(
            'absolute inset-0 z-0 size-full cursor-pointer',
            isBlocked && 'cursor-not-allowed',
          )}
        />

        {folderFileBody({ file, src, isBroken })}

        <MediaTileBadges isMissing={false} isLink isSelected={isSelected} slotNumber={slotNumber} />

        {isBusy && (
          <span className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/40">
            <Spinner />
          </span>
        )}

        <button
          type="button"
          onClick={handleExpandClick}
          aria-label={`Preview ${file.name}`}
          className="absolute top-1/2 left-1/2 z-20 flex size-10 -translate-1/2 items-center justify-center rounded-full bg-black/60 text-fg opacity-0 backdrop-blur-sm transition group-hover:opacity-100 hover:bg-black/80 focus-visible:opacity-100"
        >
          <Maximize2 size={16} aria-hidden />
        </button>
      </div>
    </Tooltip>
  )
}
