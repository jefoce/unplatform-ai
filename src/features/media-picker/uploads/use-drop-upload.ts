'use client'

import { type DragEvent, type RefObject, useEffect, useRef, useState } from 'react'
import { isEmpty } from 'lodash-es'
import { toast } from 'sonner'

import { acceptFiles, type KindExtensions } from '@/core/media-kinds'
import type { MediaKind } from '@/core/media-types'
import type { UploadItem } from '@/core/schemas/upload-item'
import { uploadFiles } from '@/lib/api/uploads'
import { toastError } from '@/lib/notify'
import { isDesktop } from '@/lib/platform'
import { registerDropZone } from '@/lib/platform/drop-router'

export interface DropUploadParams {
  // Zone id, also written as data-drop-zone.
  id: string

  enabled: boolean
  kinds: MediaKind[]
  extensions?: KindExtensions
  onUploaded: (items: UploadItem[]) => void

  /** Takes over copying when provided, for progress placeholders. */
  onFiles?: (files: File[]) => void
}

function hasFiles(event: DragEvent<HTMLElement>): boolean {
  return event.dataTransfer.types.includes('Files')
}

export interface DropProps {
  'data-drop-zone': string
  onDragEnter?: (event: DragEvent<HTMLElement>) => void
  onDragOver?: (event: DragEvent<HTMLElement>) => void
  onDragLeave?: (event: DragEvent<HTMLElement>) => void
  onDrop?: (event: DragEvent<HTMLElement>) => void
}

interface UploadDroppedParams {
  event: DragEvent<HTMLElement>
  kinds: MediaKind[]
  extensions: KindExtensions | undefined
  onFiles: ((files: File[]) => void) | undefined
  onUploaded: RefObject<(items: UploadItem[]) => void>
}

function uploadDropped(params: UploadDroppedParams): void {
  const { event, kinds, extensions, onFiles, onUploaded } = params

  const { accepted, skipped } = acceptFiles({
    files: Array.from(event.dataTransfer.files),
    kinds,
    extensions,
  })

  if (skipped > 0) {
    const suffix = skipped === 1 ? '' : 's'

    toast(`Skipped ${skipped} unsupported file${suffix}`)
  }

  if (isEmpty(accepted)) {
    return
  }

  if (onFiles) {
    onFiles(accepted)

    return
  }

  void uploadFiles(accepted)
    .then((items) => {
      onUploaded.current(items)
    })
    .catch((error) => {
      toastError(error)
    })
}

interface UseDropUpload {
  dragging: boolean
  dropProps: DropProps
}

/** Tracks drag state and uploads files dropped on the returned handlers. */
export function useDropUpload(params: DropUploadParams): UseDropUpload {
  const { id, enabled: isEnabled, kinds, extensions, onUploaded, onFiles } = params
  const [isDragging, setIsDragging] = useState(false)
  const depth = useRef(0)
  const callback = useRef(onUploaded)
  const filesCallback = useRef(onFiles)
  const kindsRef = useRef(kinds)
  const extensionsRef = useRef(extensions)

  useEffect(() => {
    callback.current = onUploaded
    filesCallback.current = onFiles
    kindsRef.current = kinds
    extensionsRef.current = extensions
  }, [onUploaded, onFiles, kinds, extensions])

  useEffect(() => {
    if (!isEnabled || !isDesktop()) {
      return
    }

    return registerDropZone(id, {
      kinds: () => {
        return kindsRef.current
      },
      extensions: () => {
        return extensionsRef.current
      },
      onHover: setIsDragging,
      onUploaded: (items) => {
        callback.current(items)
      },
    })
  }, [id, isEnabled])

  const onDragEnter = (event: DragEvent<HTMLElement>): void => {
    if (!isEnabled || !hasFiles(event)) {
      return
    }

    event.preventDefault()
    depth.current += 1
    setIsDragging(true)
  }

  const onDragOver = (event: DragEvent<HTMLElement>): void => {
    if (!isEnabled || !hasFiles(event)) {
      return
    }

    event.preventDefault()
  }

  const onDragLeave = (event: DragEvent<HTMLElement>): void => {
    if (!isEnabled || depth.current === 0) {
      return
    }

    event.preventDefault()
    depth.current = Math.max(0, depth.current - 1)

    if (depth.current === 0) {
      setIsDragging(false)
    }
  }

  const onDrop = (event: DragEvent<HTMLElement>): void => {
    if (!isEnabled || !hasFiles(event)) {
      return
    }

    event.preventDefault()
    depth.current = 0
    setIsDragging(false)

    uploadDropped({
      event,
      kinds,
      extensions,
      onFiles: filesCallback.current,
      onUploaded: callback,
    })
  }

  const zone = { 'data-drop-zone': id }
  const handlers = { ...zone, onDragEnter, onDragOver, onDragLeave, onDrop }
  const isDropProps = isDesktop()

  const dropProps = isDropProps ? zone : handlers

  return { dragging: isEnabled && isDragging, dropProps }
}
