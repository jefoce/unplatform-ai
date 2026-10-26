'use client'

import { type ChangeEvent, useId, useRef, useState } from 'react'
import { isNil } from 'lodash-es'
import { CloudUpload } from 'lucide-react'

import { acceptForKinds, type KindExtensions } from '@/core/media-kinds'
import type { MediaKind } from '@/core/media-types'
import type { UploadItem } from '@/core/schemas/upload-item'
import { cn } from '@/lib/cn'

import { useUploadFiles } from './use-upload-files'

export interface UploadTileProps {
  kinds: MediaKind[]
  max: number
  extensions?: KindExtensions
  onUploaded: (items: UploadItem[]) => void
}

function uploadLabelFor(progress: number | null): string {
  if (isNil(progress)) {
    return 'Upload file'
  }

  return `Uploading ${progress}%`
}

/** Dashed upload tile backed by a hidden file input. */
export function UploadTile(props: UploadTileProps) {
  const { kinds, max, extensions } = props
  const fileInputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isOver, setIsOver] = useState(false)
  const { progress, isBusy, handleFiles } = useUploadFiles(props.onUploaded)

  const handleOpenFile = () => {
    return inputRef.current?.click()
  }

  const handleDragEnter = () => {
    setIsOver(true)
  }

  const handleDragOver = () => {
    setIsOver(true)
  }

  const handleDragLeave = () => {
    setIsOver(false)
  }

  const handleDrop = () => {
    setIsOver(false)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])

    event.target.value = ''
    void handleFiles(files)
  }

  const uploadLabel = uploadLabelFor(progress)

  return (
    <div
      className={cn(
        'relative aspect-square rounded-lg border border-dashed border-divider bg-white/2 transition',
        isOver && 'border-lime bg-lime/5',
      )}
    >
      <button
        type="button"
        disabled={isBusy}
        onClick={handleOpenFile}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex size-full flex-col items-center justify-center gap-2 rounded-lg text-xs font-medium text-fg-2 transition hover:bg-white/4',
          isBusy && 'opacity-60',
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-white/10">
          <CloudUpload className="size-5" aria-hidden />
        </span>
        <span>{uploadLabel}</span>
      </button>
      <input
        id={fileInputId}
        name="file"
        aria-label="Upload file"
        ref={inputRef}
        type="file"
        hidden
        accept={acceptForKinds(kinds, extensions)}
        multiple={max > 1}
        onChange={handleFileChange}
      />
    </div>
  )
}
