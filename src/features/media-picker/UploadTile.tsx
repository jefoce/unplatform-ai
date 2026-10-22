'use client'

import { useCallback, useId, useRef, useState } from 'react'
import { isEmpty, isNil } from 'lodash-es'
import { CloudUpload } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { toast } from 'sonner'

import { acceptForKinds, type KindExtensions } from '@/core/media-kinds'
import type { MediaKind, UploadItem } from '@/core/types'
import { cn } from '@/lib/cn'
import { errorMessage } from '@/lib/errors'

import { uploadFilesWithProgress } from './api'

export interface UploadTileProps {
  kinds: MediaKind[]
  max: number
  extensions?: KindExtensions
  onUploaded: (items: UploadItem[]) => void
}

/** Dashed upload tile backed by a hidden file input. */
export function UploadTile(props: UploadTileProps) {
  const { kinds, max, extensions, onUploaded } = props
  const fileInputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [isOver, setIsOver] = useState(false)
  const isBusy = !isNil(progress)

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (isEmpty(files)) return

      setProgress(0)

      const handleProgress = (sent: number, total: number) => {
        setProgress(total > 0 ? Math.round((sent / total) * 100) : 0)
      }

      try {
        const items = await uploadFilesWithProgress({ files, onProgress: handleProgress })

        onUploaded(items)
      } catch (error) {
        toast.error(errorMessage(error))
      } finally {
        setProgress(null)
      }
    },
    [onUploaded],
  )

  const handleOpenFile = useCallback(() => inputRef.current?.click(), [])
  const handleDragEnter = useCallback(() => setIsOver(true), [])
  const handleDragOver = useCallback(() => setIsOver(true), [])
  const handleDragLeave = useCallback(() => setIsOver(false), [])
  const handleDrop = useCallback(() => setIsOver(false), [])
  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? [])

      event.target.value = ''
      void handleFiles(files)
    },
    [handleFiles],
  )

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
        <span>{isNil(progress) ? 'Upload file' : `Uploading ${progress}%`}</span>
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
