'use client'

import { type RefObject, useEffect, useRef, useState } from 'react'
import { isNil } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import type { GeneratorTab } from '@/core/schemas/generation-record'
import { useGeneratorStore } from '@/features/generator/store/store'
import { type PickerRequest, useMediaPickerStore } from '@/features/media-picker/picker/store'
import { getPlatform } from '@/lib/platform'

export interface UseWindowFileInputParams {
  onFiles: (files: File[]) => void
  onPaths: (paths: string[]) => void
}

interface UseWindowFileInput {
  isDragging: boolean
  hint: string
}

const EDITABLE_SELECTOR = 'input, textarea, [contenteditable="true"], [contenteditable=""]'

function hasFiles(dataTransfer: DataTransfer | null): boolean {
  return !isNil(dataTransfer) && dataTransfer.types.includes('Files')
}

interface PasteTarget {
  files: File[]
  isEditing: boolean
  text: string
}

function readPasteTarget(event: ClipboardEvent): PasteTarget {
  const files = Array.from(event.clipboardData?.files ?? [])
  const target = event.target instanceof HTMLElement ? event.target : null
  const text = event.clipboardData?.getData('text/plain') ?? ''

  return { files, isEditing: Boolean(target?.closest(EDITABLE_SELECTOR)), text }
}

function hintFor(request: PickerRequest | null, tab: GeneratorTab): string {
  if (isNil(request)) {
    if (tab === 'references') {
      return 'as references'
    }

    return 'as start frame'
  }

  if (request.mode.kind === 'toggle') {
    return 'as references'
  }

  return 'as start frame'
}

interface DesktopDropParams {
  setDragging: (isDragging: boolean) => void
  onPaths: RefObject<(paths: string[]) => void>
}

/** Desktop Finder drops feed the same drag state as the HTML listeners. */
function useDesktopDrop(params: DesktopDropParams): void {
  const { setDragging, onPaths } = params

  useEffect(() => {
    let stop: (() => void) | null = null
    let isCancelled = false

    void (async () => {
      const platform = await getPlatform()

      if (isCancelled) {
        return
      }

      const unsubscribe = await platform.onFileDrop((event) => {
        if (event.type === 'leave') {
          setDragging(false)

          return
        }

        if (event.type === 'over') {
          setDragging(true)

          return
        }

        setDragging(false)

        if (event.paths.length > 0) {
          onPaths.current(event.paths)
        }
      })

      if (isCancelled) {
        unsubscribe()

        return
      }

      stop = unsubscribe
    })()

    return () => {
      isCancelled = true
      stop?.()
    }
  }, [setDragging, onPaths])
}

/** One window drag, drop and paste handler for the generator and the open picker. */
export function useWindowFileInput(params: UseWindowFileInputParams): UseWindowFileInput {
  const { onFiles, onPaths } = params
  const [isDragging, setIsDragging] = useState(false)

  const request = useMediaPickerStore((state) => {
    return state.request
  })

  const tab = useGeneratorStore((state) => {
    return state.tab
  })

  const depth = useRef(0)
  const callback = useRef(onFiles)
  const pathsCallback = useRef(onPaths)

  useEffect(() => {
    callback.current = onFiles
    pathsCallback.current = onPaths
  }, [onFiles, onPaths])

  useDesktopDrop({ setDragging: setIsDragging, onPaths: pathsCallback })

  useEffect(() => {
    const handleDragEnter = (event: DragEvent): void => {
      if (!hasFiles(event.dataTransfer)) {
        return
      }

      event.preventDefault()
      depth.current += 1
      setIsDragging(true)
    }

    const handleDragOver = (event: DragEvent): void => {
      if (!hasFiles(event.dataTransfer)) {
        return
      }

      event.preventDefault()
    }

    const handleDragLeave = (event: DragEvent): void => {
      if (depth.current === 0) {
        return
      }

      event.preventDefault()
      depth.current = Math.max(0, depth.current - 1)

      if (depth.current === 0) {
        setIsDragging(false)
      }
    }

    const handleDrop = (event: DragEvent): void => {
      if (!hasFiles(event.dataTransfer)) {
        return
      }

      event.preventDefault()
      depth.current = 0
      setIsDragging(false)

      const files = Array.from(event.dataTransfer?.files ?? [])

      if (files.length > 0) {
        callback.current(files)
      }
    }

    const handlePaste = (event: ClipboardEvent): void => {
      const { files, isEditing, text } = readPasteTarget(event)

      if (isEditing && isNonEmptyString(text)) {
        return
      }

      if (files.length === 0) {
        return
      }

      event.preventDefault()
      callback.current(files)
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)
    window.addEventListener('paste', handlePaste)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
      window.removeEventListener('paste', handlePaste)
    }
  }, [])

  return { isDragging, hint: hintFor(request, tab) }
}
